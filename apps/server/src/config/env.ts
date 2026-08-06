import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'file:./dev.db'),
  sessionSecret: required('SESSION_SECRET', 'dev-only-secret-change-me'),
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5),
  loginLockoutMinutes: Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',

  apacheRootPath: process.env.APACHE_ROOT_PATH ?? 'D:\\xampp\\apache',
  apacheExecutablePath:
    process.env.APACHE_EXECUTABLE_PATH ?? 'D:\\xampp\\apache\\bin\\httpd.exe',
  apacheVhostsPath:
    process.env.APACHE_VHOSTS_PATH ??
    'D:\\xampp\\apache\\conf\\extra\\httpd-vhosts.conf',
  apacheManagedSitesPath:
    process.env.APACHE_MANAGED_SITES_PATH ?? 'D:\\xampp\\apache\\conf\\mw-sites',
  apacheBackupPath:
    process.env.APACHE_BACKUP_PATH ?? 'D:\\xampp\\apache\\conf\\mw-backups',
  sslCertificatePath:
    process.env.SSL_CERTIFICATE_PATH ??
    'D:\\certs\\roboworks_wildcard\\_.roboworks.co.kr-crt.pem',
  sslCertificateKeyPath:
    process.env.SSL_CERTIFICATE_KEY_PATH ??
    'D:\\certs\\roboworks_wildcard\\_.roboworks.co.kr-key.pem',
  defaultDomainSuffix: process.env.DEFAULT_DOMAIN_SUFFIX ?? 'roboworks.co.kr',
  defaultHealthCheckTimeoutMs: Number(
    process.env.DEFAULT_HEALTH_CHECK_TIMEOUT_MS ?? 3000
  ),

  // "mock" (default, safe for dev/CI) or "real" (only on the actual Windows
  // Server host where httpd.exe exists and Apache must actually be controlled).
  apacheCommandRunner: (process.env.APACHE_COMMAND_RUNNER ?? 'mock') as
    | 'mock'
    | 'real',

  // Only used when apacheCommandRunner === 'mock'. Lets local development
  // simulate a healthy Apache (default) or an unreachable one, without
  // ever touching a real process.
  apacheMockProcessRunning: (process.env.APACHE_MOCK_PROCESS_RUNNING ?? 'true') === 'true',
};
