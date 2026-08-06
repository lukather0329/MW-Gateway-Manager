import { domainToConfigFileName } from '../../utils/validation';

export interface ProgramConfigInput {
  domain: string; // already validated/normalized
  targetProtocol: 'http' | 'https';
  targetHost: string; // already validated
  targetPort: number; // already validated
  websocketEnabled: boolean;
  sslEnabled: boolean;
}

export interface ApacheSettingsInput {
  sslCertificatePath: string;
  sslCertificateKeyPath: string;
}

export interface GeneratedConfig {
  fileName: string;
  filePath: string;
  content: string;
}

/**
 * Builds the VirtualHost config for a single program. Only ever receives
 * values that have already passed the validators in utils/validation.ts —
 * it does not re-validate, so callers must not skip that step.
 */
export class ApacheConfigGenerator {
  generate(
    program: ProgramConfigInput,
    settings: ApacheSettingsInput,
    managedSitesPath: string
  ): GeneratedConfig {
    const fileName = domainToConfigFileName(program.domain);
    const filePath = joinWindowsPath(managedSitesPath, fileName);
    const content = program.sslEnabled
      ? this.buildSslConfig(program, settings)
      : this.buildPlainConfig(program);

    return { fileName, filePath, content };
  }

  private buildProxyBlock(program: ProgramConfigInput): string {
    const targetBase = `${program.targetProtocol}://${program.targetHost}:${program.targetPort}`;

    if (!program.websocketEnabled) {
      return [
        '    ProxyPreserveHost On',
        '    ProxyRequests Off',
        '',
        `    ProxyPass / ${targetBase}/`,
        `    ProxyPassReverse / ${targetBase}/`,
      ].join('\n');
    }

    const wsScheme = program.targetProtocol === 'https' ? 'wss' : 'ws';
    const wsTarget = `${wsScheme}://${program.targetHost}:${program.targetPort}`;

    return [
      '    ProxyPreserveHost On',
      '    ProxyRequests Off',
      '',
      '    RewriteEngine On',
      '    RewriteCond %{HTTP:Upgrade} =websocket [NC]',
      `    RewriteRule ^/(.*)$ ${wsTarget}/$1 [P,L]`,
      '    RewriteCond %{HTTP:Upgrade} !=websocket [NC]',
      `    RewriteRule ^/(.*)$ ${targetBase}/$1 [P,L]`,
      '',
      `    ProxyPassReverse / ${targetBase}/`,
    ].join('\n');
  }

  private buildPlainConfig(program: ProgramConfigInput): string {
    const proxyBlock = this.buildProxyBlock(program);
    return [
      '<VirtualHost *:80>',
      `    ServerName ${program.domain}`,
      '',
      proxyBlock,
      '',
      `    ErrorLog "logs/${program.domain}-error.log"`,
      `    CustomLog "logs/${program.domain}-access.log" common`,
      '</VirtualHost>',
      '',
    ].join('\n');
  }

  private buildSslConfig(
    program: ProgramConfigInput,
    settings: ApacheSettingsInput
  ): string {
    const proxyBlock = this.buildProxyBlock(program);
    return [
      '<VirtualHost *:80>',
      `    ServerName ${program.domain}`,
      '',
      '    RewriteEngine On',
      `    RewriteRule ^/(.*)$ https://${program.domain}/$1 [R=301,L]`,
      '',
      `    ErrorLog "logs/${program.domain}-error.log"`,
      `    CustomLog "logs/${program.domain}-access.log" common`,
      '</VirtualHost>',
      '',
      '<VirtualHost *:443>',
      `    ServerName ${program.domain}`,
      '',
      proxyBlock,
      '',
      '    SSLEngine on',
      `    SSLCertificateFile "${toForwardSlashes(settings.sslCertificatePath)}"`,
      `    SSLCertificateKeyFile "${toForwardSlashes(settings.sslCertificateKeyPath)}"`,
      '',
      `    ErrorLog "logs/${program.domain}-ssl-error.log"`,
      `    CustomLog "logs/${program.domain}-ssl-access.log" common`,
      '</VirtualHost>',
      '',
    ].join('\n');
  }
}

function toForwardSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

function joinWindowsPath(dir: string, file: string): string {
  const normalizedDir = dir.endsWith('\\') || dir.endsWith('/') ? dir.slice(0, -1) : dir;
  return `${normalizedDir}\\${file}`;
}
