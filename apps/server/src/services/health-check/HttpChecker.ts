import http from 'node:http';
import https from 'node:https';

export interface HttpCheckResult {
  responded: boolean;
  statusCode?: number;
  responseTimeMs: number;
  errorMessage?: string;
}

export function checkHttp(
  protocol: 'http' | 'https',
  host: string,
  port: number,
  requestPath: string,
  timeoutMs: number
): Promise<HttpCheckResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const client = protocol === 'https' ? https : http;
    let settled = false;

    const finish = (result: HttpCheckResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const req = client.request(
      {
        host,
        port,
        path: requestPath,
        method: 'GET',
        timeout: timeoutMs,
        // Self-signed certs are common on internal targets; this check
        // only measures reachability, it never sends or exposes secrets.
        rejectUnauthorized: false,
      },
      (res) => {
        res.on('data', () => undefined);
        res.on('end', () =>
          finish({
            responded: true,
            statusCode: res.statusCode,
            responseTimeMs: Date.now() - start,
          })
        );
      }
    );

    req.on('timeout', () => {
      req.destroy();
      finish({ responded: false, responseTimeMs: Date.now() - start, errorMessage: 'HTTP request timeout' });
    });
    req.on('error', (err) => {
      finish({ responded: false, responseTimeMs: Date.now() - start, errorMessage: err.message });
    });

    req.end();
  });
}
