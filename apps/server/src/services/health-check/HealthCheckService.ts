import { checkTcp } from './TcpChecker';
import { checkHttp } from './HttpChecker';

export type HealthCheckStatus =
  | 'UNREACHABLE'
  | 'TCP_OK'
  | 'HTTP_OK'
  | 'HEALTHY'
  | 'HEALTH_CHECK_FAILED';

export interface HealthCheckInput {
  targetProtocol: 'http' | 'https';
  targetHost: string;
  targetPort: number;
  healthCheckPath?: string | null;
}

export interface HealthCheckOutcome {
  status: HealthCheckStatus;
  tcpOk: boolean;
  httpOk: boolean;
  healthOk: boolean | null;
  statusCode?: number;
  responseTimeMs: number;
  errorMessage?: string;
}

/**
 * Distinguishes "target unreachable" from "target responded but the
 * configured health path failed" from "no health path configured, so a
 * 404 on / does not by itself mean the program is down" — spec 6.5
 * explicitly forbids treating a bare 404 as an outage.
 */
export class HealthCheckService {
  async check(input: HealthCheckInput, timeoutMs: number): Promise<HealthCheckOutcome> {
    const start = Date.now();
    const tcp = await checkTcp(input.targetHost, input.targetPort, timeoutMs);
    if (!tcp.reachable) {
      return {
        status: 'UNREACHABLE',
        tcpOk: false,
        httpOk: false,
        healthOk: null,
        responseTimeMs: Date.now() - start,
        errorMessage: tcp.errorMessage,
      };
    }

    const explicitHealthPath = Boolean(input.healthCheckPath && input.healthCheckPath !== '/');
    const effectivePath = input.healthCheckPath || '/';

    const http = await checkHttp(
      input.targetProtocol,
      input.targetHost,
      input.targetPort,
      effectivePath,
      timeoutMs
    );

    const responseTimeMs = Date.now() - start;

    if (!http.responded) {
      return {
        status: 'TCP_OK',
        tcpOk: true,
        httpOk: false,
        healthOk: null,
        responseTimeMs,
        errorMessage: http.errorMessage,
      };
    }

    const statusIs2xx = (http.statusCode ?? 0) >= 200 && (http.statusCode ?? 0) < 300;

    if (!explicitHealthPath) {
      // No health endpoint configured: a 404/other status on "/" does not
      // prove the program is down, so we only report that HTTP responded.
      return {
        status: 'HTTP_OK',
        tcpOk: true,
        httpOk: true,
        healthOk: null,
        statusCode: http.statusCode,
        responseTimeMs,
      };
    }

    return {
      status: statusIs2xx ? 'HEALTHY' : 'HEALTH_CHECK_FAILED',
      tcpOk: true,
      httpOk: true,
      healthOk: statusIs2xx,
      statusCode: http.statusCode,
      responseTimeMs,
    };
  }
}
