import net from 'node:net';

export interface TcpCheckResult {
  reachable: boolean;
  responseTimeMs: number;
  errorMessage?: string;
}

export function checkTcp(host: string, port: number, timeoutMs: number): Promise<TcpCheckResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (result: TcpCheckResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ reachable: true, responseTimeMs: Date.now() - start }));
    socket.once('timeout', () =>
      finish({ reachable: false, responseTimeMs: Date.now() - start, errorMessage: 'TCP connect timeout' })
    );
    socket.once('error', (err) =>
      finish({ reachable: false, responseTimeMs: Date.now() - start, errorMessage: err.message })
    );

    socket.connect(port, host);
  });
}
