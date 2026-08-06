import { describe, expect, it } from 'vitest';
import { ApacheConfigGenerator } from '../../src/services/apache/ApacheConfigGenerator';

const generator = new ApacheConfigGenerator();
const settings = {
  sslCertificatePath: 'D:\\certs\\roboworks_wildcard\\_.roboworks.co.kr-crt.pem',
  sslCertificateKeyPath: 'D:\\certs\\roboworks_wildcard\\_.roboworks.co.kr-key.pem',
};
const managedSitesPath = 'D:\\xampp\\apache\\conf\\mw-sites';

describe('ApacheConfigGenerator', () => {
  it('derives the file name and path from the domain', () => {
    const result = generator.generate(
      {
        domain: 'camera.roboworks.co.kr',
        targetProtocol: 'http',
        targetHost: '127.0.0.1',
        targetPort: 3101,
        websocketEnabled: false,
        sslEnabled: false,
      },
      settings,
      managedSitesPath
    );
    expect(result.fileName).toBe('camera.roboworks.co.kr.conf');
    expect(result.filePath).toBe('D:\\xampp\\apache\\conf\\mw-sites\\camera.roboworks.co.kr.conf');
  });

  it('generates a plain HTTP-only VirtualHost when SSL is disabled', () => {
    const result = generator.generate(
      {
        domain: 'plain.roboworks.co.kr',
        targetProtocol: 'http',
        targetHost: '127.0.0.1',
        targetPort: 8080,
        websocketEnabled: false,
        sslEnabled: false,
      },
      settings,
      managedSitesPath
    );
    expect(result.content).toContain('<VirtualHost *:80>');
    expect(result.content).not.toContain('<VirtualHost *:443>');
    expect(result.content).not.toContain('SSLEngine on');
    expect(result.content).toContain('ProxyPass / http://127.0.0.1:8080/');
    expect(result.content).toContain('ProxyPassReverse / http://127.0.0.1:8080/');
  });

  it('generates an HTTP->HTTPS redirect plus an SSL VirtualHost when SSL is enabled', () => {
    const result = generator.generate(
      {
        domain: 'camera.roboworks.co.kr',
        targetProtocol: 'http',
        targetHost: '127.0.0.1',
        targetPort: 3101,
        websocketEnabled: false,
        sslEnabled: true,
      },
      settings,
      managedSitesPath
    );
    expect(result.content).toContain('<VirtualHost *:80>');
    expect(result.content).toContain('RewriteRule ^/(.*)$ https://camera.roboworks.co.kr/$1 [R=301,L]');
    expect(result.content).toContain('<VirtualHost *:443>');
    expect(result.content).toContain('SSLEngine on');
    expect(result.content).toContain('SSLCertificateFile "D:/certs/roboworks_wildcard/_.roboworks.co.kr-crt.pem"');
    expect(result.content).toContain('SSLCertificateKeyFile "D:/certs/roboworks_wildcard/_.roboworks.co.kr-key.pem"');
  });

  it('adds WebSocket upgrade rewrite rules using ws:// for an http backend', () => {
    const result = generator.generate(
      {
        domain: 'camera.roboworks.co.kr',
        targetProtocol: 'http',
        targetHost: '127.0.0.1',
        targetPort: 3101,
        websocketEnabled: true,
        sslEnabled: true,
      },
      settings,
      managedSitesPath
    );
    expect(result.content).toContain('RewriteCond %{HTTP:Upgrade} =websocket [NC]');
    expect(result.content).toContain('RewriteRule ^/(.*)$ ws://127.0.0.1:3101/$1 [P,L]');
    expect(result.content).toContain('RewriteCond %{HTTP:Upgrade} !=websocket [NC]');
    expect(result.content).toContain('RewriteRule ^/(.*)$ http://127.0.0.1:3101/$1 [P,L]');
  });

  it('uses wss:// for the WebSocket upgrade target when the backend is https', () => {
    const result = generator.generate(
      {
        domain: 'camera.roboworks.co.kr',
        targetProtocol: 'https',
        targetHost: '127.0.0.1',
        targetPort: 3443,
        websocketEnabled: true,
        sslEnabled: true,
      },
      settings,
      managedSitesPath
    );
    expect(result.content).toContain('RewriteRule ^/(.*)$ wss://127.0.0.1:3443/$1 [P,L]');
  });

  it('omits WebSocket rewrite rules entirely when WebSocket is disabled', () => {
    const result = generator.generate(
      {
        domain: 'camera.roboworks.co.kr',
        targetProtocol: 'http',
        targetHost: '127.0.0.1',
        targetPort: 3101,
        websocketEnabled: false,
        sslEnabled: true,
      },
      settings,
      managedSitesPath
    );
    expect(result.content).not.toContain('Upgrade');
    expect(result.content).not.toContain('[P,L]');
  });

  it('includes distinct log file names per VirtualHost', () => {
    const result = generator.generate(
      {
        domain: 'camera.roboworks.co.kr',
        targetProtocol: 'http',
        targetHost: '127.0.0.1',
        targetPort: 3101,
        websocketEnabled: false,
        sslEnabled: true,
      },
      settings,
      managedSitesPath
    );
    expect(result.content).toContain('logs/camera.roboworks.co.kr-error.log');
    expect(result.content).toContain('logs/camera.roboworks.co.kr-access.log');
    expect(result.content).toContain('logs/camera.roboworks.co.kr-ssl-error.log');
    expect(result.content).toContain('logs/camera.roboworks.co.kr-ssl-access.log');
  });
});
