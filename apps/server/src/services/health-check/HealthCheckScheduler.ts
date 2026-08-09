import { programRepository } from '../../repositories/programRepository';
import { prisma } from '../../config/prisma';
import { HealthCheckService } from './HealthCheckService';
import { SettingsService } from '../settings/SettingsService';
import { AuditService } from '../audit/AuditService';

/**
 * Re-checks every enabled program's health on a fixed interval, independent
 * of manual "연결 테스트" clicks or the one-off check that runs right after
 * an apply. This was the top-priority gap noted in NEXT_STEPS.md — without
 * it, a program's health status on screen is only as fresh as the last
 * manual click.
 */
export class HealthCheckScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
    private readonly intervalMs: number
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce(): Promise<void> {
    // Skip this tick rather than queue up if the previous run is still going
    // (e.g. many programs + slow/unreachable targets exceeding the interval).
    if (this.running) return;
    this.running = true;
    try {
      const programs = await programRepository.list();
      const settings = await this.settingsService.get();

      for (const program of programs.filter((p) => p.enabled)) {
        try {
          const outcome = await this.healthCheckService.check(
            {
              targetProtocol: program.targetProtocol as 'http' | 'https',
              targetHost: program.targetHost,
              targetPort: program.targetPort,
              healthCheckPath: program.healthCheckPath,
            },
            settings.defaultHealthCheckTimeoutMs
          );

          await prisma.programHealthCheck.create({
            data: {
              programId: program.id,
              status: outcome.status,
              tcpOk: outcome.tcpOk,
              httpOk: outcome.httpOk,
              healthOk: outcome.healthOk,
              statusCode: outcome.statusCode,
              responseTimeMs: outcome.responseTimeMs,
              errorMessage: outcome.errorMessage,
            },
          });

          if (outcome.status !== program.healthStatus) {
            await this.auditService.log({
              action: 'PROGRAM_TEST_CONNECTION',
              actorUsername: null,
              targetType: 'Program',
              targetId: program.id,
              result: outcome.status === 'UNREACHABLE' ? 'FAILURE' : 'SUCCESS',
              detail: { status: outcome.status, source: 'scheduler' },
            });
          }

          await programRepository.update(program.id, {
            healthStatus: outcome.status,
            lastHealthCheckedAt: new Date(),
          });
        } catch {
          // One program's check failing (bad DNS, thrown error, etc.) must
          // not stop the rest of the batch from being checked.
        }
      }
    } finally {
      this.running = false;
    }
  }
}
