import http from 'node:http';
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { HealthCheckService } from '../../src/services/health-check/HealthCheckService';

const service = new HealthCheckService();

function listen(server: net.Server | http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
}

function close(server: net.Server | http.Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
    // net/http Server.close() waits for existing sockets to end on their
    // own; a client-side req.destroy() doesn't always finish that
    // handshake fast enough for a test teardown, so cap the wait instead
    // of risking the whole suite hanging on a stuck half-closed socket.
    setTimeout(resolve, 500).unref();
  });
}

describe('HealthCheckService (real ephemeral local TCP/HTTP servers, no real Apache involved)', () => {
  let server: net.Server | http.Server | null = null;
  let sockets: net.Socket[] = [];

  afterEach(async () => {
    for (const socket of sockets) socket.destroy();
    sockets = [];
    if (server) {
      await close(server);
      server = null;
    }
  });

  it('reports UNREACHABLE when nothing is listening on the target port', async () => {
    // 127.0.0.1:1 is reserved and never has anything listening.
    const result = await service.check(
      { targetProtocol: 'http', targetHost: '127.0.0.1', targetPort: 1, healthCheckPath: '/' },
      500
    );
    expect(result.status).toBe('UNREACHABLE');
    expect(result.tcpOk).toBe(false);
  });

  it('reports TCP_OK when the port is open but nothing speaks HTTP', async () => {
    const tcpServer = net.createServer((socket) => sockets.push(socket));
    server = tcpServer;
    const port = await listen(tcpServer);

    const result = await service.check(
      { targetProtocol: 'http', targetHost: '127.0.0.1', targetPort: port, healthCheckPath: '/' },
      500
    );
    expect(result.status).toBe('TCP_OK');
    expect(result.tcpOk).toBe(true);
    expect(result.httpOk).toBe(false);
  });

  it('reports HTTP_OK (not an outage) for a 404 on "/" when no health path is configured', async () => {
    const httpServer = http.createServer((_req, res) => {
      res.writeHead(404);
      res.end('Cannot GET /');
    });
    server = httpServer;
    const port = await listen(httpServer);

    const result = await service.check(
      { targetProtocol: 'http', targetHost: '127.0.0.1', targetPort: port, healthCheckPath: null },
      1000
    );
    expect(result.status).toBe('HTTP_OK');
    expect(result.httpOk).toBe(true);
    expect(result.healthOk).toBeNull();
    expect(result.statusCode).toBe(404);
  });

  it('reports HEALTHY when the configured health path returns 2xx', async () => {
    const httpServer = http.createServer((req, res) => {
      if (req.url === '/api/health') {
        res.writeHead(200);
        res.end('ok');
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server = httpServer;
    const port = await listen(httpServer);

    const result = await service.check(
      { targetProtocol: 'http', targetHost: '127.0.0.1', targetPort: port, healthCheckPath: '/api/health' },
      1000
    );
    expect(result.status).toBe('HEALTHY');
    expect(result.healthOk).toBe(true);
  });

  it('reports HEALTH_CHECK_FAILED when the configured health path returns a non-2xx status', async () => {
    const httpServer = http.createServer((_req, res) => {
      res.writeHead(503);
      res.end('unhealthy');
    });
    server = httpServer;
    const port = await listen(httpServer);

    const result = await service.check(
      { targetProtocol: 'http', targetHost: '127.0.0.1', targetPort: port, healthCheckPath: '/api/health' },
      1000
    );
    expect(result.status).toBe('HEALTH_CHECK_FAILED');
    expect(result.healthOk).toBe(false);
    expect(result.statusCode).toBe(503);
  });
});
