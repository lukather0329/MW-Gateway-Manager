import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HealthCheckScheduler } from '../../src/services/health-check/HealthCheckScheduler';
import { HealthCheckService } from '../../src/services/health-check/HealthCheckService';
import { SettingsService } from '../../src/services/settings/SettingsService';
import { AuditService } from '../../src/services/audit/AuditService';
import { prisma } from '../../src/config/prisma';
import { resetDatabase } from './api/helpers';

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
    setTimeout(resolve, 500).unref();
  });
}

async function createProgram(overrides: Partial<Parameters<typeof prisma.program.create>[0]['data']> = {}) {
  return prisma.program.create({
    data: {
      name: '테스트 프로그램',
      domain: `scheduler-test-${Math.random().toString(36).slice(2)}.roboworks.co.kr`,
      targetProtocol: 'http',
      targetHost: '127.0.0.1',
      targetPort: 1,
      healthCheckPath: '/',
      websocketEnabled: false,
      sslEnabled: false,
      enabled: true,
      configFileName: 'x.conf',
      configStatus: 'NOT_APPLIED',
      healthStatus: 'UNREACHABLE',
      ...overrides,
    },
  });
}

describe('HealthCheckScheduler', () => {
  let server: http.Server | null = null;

  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(async () => {
    await resetDatabase();
    if (server) {
      await close(server);
      server = null;
    }
  });

  it('checks every enabled program and records the outcome', async () => {
    const httpServer = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    server = httpServer;
    const port = await listen(httpServer);

    const program = await createProgram({ targetPort: port });

    const scheduler = new HealthCheckScheduler(
      new HealthCheckService(),
      new SettingsService(),
      new AuditService(),
      60000
    );
    await scheduler.runOnce();

    const updated = await prisma.program.findUniqueOrThrow({ where: { id: program.id } });
    expect(updated.healthStatus).toBe('HTTP_OK');
    expect(updated.lastHealthCheckedAt).not.toBeNull();

    const checks = await prisma.programHealthCheck.findMany({ where: { programId: program.id } });
    expect(checks).toHaveLength(1);
    expect(checks[0].status).toBe('HTTP_OK');
  });

  it('skips disabled programs', async () => {
    const program = await createProgram({ enabled: false, targetPort: 1 });

    const scheduler = new HealthCheckScheduler(
      new HealthCheckService(),
      new SettingsService(),
      new AuditService(),
      60000
    );
    await scheduler.runOnce();

    const updated = await prisma.program.findUniqueOrThrow({ where: { id: program.id } });
    expect(updated.lastHealthCheckedAt).toBeNull();

    const checks = await prisma.programHealthCheck.findMany({ where: { programId: program.id } });
    expect(checks).toHaveLength(0);
  });

  it('logs an audit entry only when the status actually changes', async () => {
    const program = await createProgram({ targetPort: 1, healthStatus: 'UNREACHABLE' });

    const scheduler = new HealthCheckScheduler(
      new HealthCheckService(),
      new SettingsService(),
      new AuditService(),
      60000
    );

    await scheduler.runOnce();
    await scheduler.runOnce();

    const checks = await prisma.programHealthCheck.findMany({ where: { programId: program.id } });
    expect(checks).toHaveLength(2);

    const logs = await prisma.auditLog.findMany({
      where: { targetId: program.id, action: 'PROGRAM_TEST_CONNECTION' },
    });
    // Status stayed UNREACHABLE both times, so no audit entry should be
    // written on the second run.
    expect(logs).toHaveLength(0);
  });

  it('continues checking remaining programs when one throws', async () => {
    const httpServer = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    server = httpServer;
    const port = await listen(httpServer);

    // targetHost '' triggers a thrown error inside the TCP check rather
    // than a clean UNREACHABLE result, exercising the per-program try/catch.
    await createProgram({ targetHost: '', targetPort: 0 });
    const healthyProgram = await createProgram({ targetPort: port });

    const scheduler = new HealthCheckScheduler(
      new HealthCheckService(),
      new SettingsService(),
      new AuditService(),
      60000
    );
    await expect(scheduler.runOnce()).resolves.not.toThrow();

    const updated = await prisma.program.findUniqueOrThrow({ where: { id: healthyProgram.id } });
    expect(updated.healthStatus).toBe('HTTP_OK');
  });
});
