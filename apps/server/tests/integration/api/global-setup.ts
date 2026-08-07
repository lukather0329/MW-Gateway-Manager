import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Runs once before the whole test run (Vitest globalSetup). Points the
 * app at a throwaway SQLite DB and a throwaway "Apache" directory tree
 * under the OS temp dir, so API integration tests never touch the
 * developer's dev.db or .local-apache-sim, and never require a real
 * Apache installation (APACHE_COMMAND_RUNNER stays "mock").
 */
export default async function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-api-test-'));
  const dbPath = path.join(root, 'test.db');

  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.SESSION_SECRET = 'test-secret';
  process.env.LOGIN_MAX_ATTEMPTS = '5';
  process.env.LOGIN_LOCKOUT_MINUTES = '15';
  process.env.WEB_ORIGIN = 'http://localhost:5173';
  process.env.APACHE_ROOT_PATH = path.join(root, 'apache');
  process.env.APACHE_EXECUTABLE_PATH = path.join(root, 'apache', 'bin', 'httpd.exe');
  process.env.APACHE_VHOSTS_PATH = path.join(root, 'apache', 'conf', 'httpd-vhosts.conf');
  process.env.APACHE_MANAGED_SITES_PATH = path.join(root, 'apache', 'conf', 'mw-sites');
  process.env.APACHE_BACKUP_PATH = path.join(root, 'apache', 'conf', 'mw-backups');
  process.env.SSL_CERTIFICATE_PATH = path.join(root, 'apache', 'certs', 'crt.pem');
  process.env.SSL_CERTIFICATE_KEY_PATH = path.join(root, 'apache', 'certs', 'key.pem');
  process.env.DEFAULT_DOMAIN_SUFFIX = 'roboworks.co.kr';
  process.env.DEFAULT_HEALTH_CHECK_TIMEOUT_MS = '500';
  process.env.APACHE_COMMAND_RUNNER = 'mock';
  process.env.APACHE_MOCK_PROCESS_RUNNING = 'true';
  // Marker that this globalSetup actually ran and DATABASE_URL really was
  // redirected to the throwaway DB above. helpers.ts refuses to run any
  // destructive database operation unless this is set — see the comment
  // there for why (a real dev.db got wiped once by a test invocation that
  // skipped Vitest's config/globalSetup resolution).
  process.env.MW_TEST_DB_ISOLATED = dbPath;

  fs.mkdirSync(path.dirname(process.env.APACHE_VHOSTS_PATH), { recursive: true });
  fs.writeFileSync(process.env.APACHE_VHOSTS_PATH, '# test vhosts\n', 'utf-8');
  fs.mkdirSync(process.env.APACHE_MANAGED_SITES_PATH, { recursive: true });

  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..', '..', '..'),
    env: process.env,
    stdio: 'pipe',
  });

  return async () => {
    fs.rmSync(root, { recursive: true, force: true });
  };
}
