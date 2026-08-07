import request from 'supertest';
import { createApp } from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { services } from '../../../src/services/container';

let userCounter = 0;

/**
 * Guards every destructive helper in this file against ever running
 * against a real database. Vitest's `globalSetup` (see global-setup.ts)
 * is what redirects DATABASE_URL to a throwaway temp-dir SQLite file and
 * sets MW_TEST_DB_ISOLATED as proof it actually ran — if a test file gets
 * invoked in a way that skips config/globalSetup resolution (e.g. a
 * `--prefix`/`--config`/cwd mismatch), Prisma silently falls back to the
 * default `file:./dev.db`, which resolves relative to prisma/schema.prisma
 * regardless of process.cwd() and therefore points straight at the real
 * developer database. That happened once during this project (wiped the
 * real dev.db's users/programs) — this check turns that failure mode into
 * a loud thrown error instead of silent data loss.
 */
function assertIsolatedTestDatabase(): void {
  const marker = process.env.MW_TEST_DB_ISOLATED;
  const actual = process.env.DATABASE_URL;
  if (!marker || !actual || actual !== `file:${marker}`) {
    throw new Error(
      'Refusing to run: DATABASE_URL does not point at the isolated test ' +
        'database set up by tests/integration/api/global-setup.ts. This ' +
        'usually means Vitest was invoked in a way that skipped ' +
        'vitest.config.ts (e.g. via `npx --prefix`, or from the wrong ' +
        'working directory). Run tests as `cd apps/server && npx vitest ' +
        'run` (or `npm test` from that directory) instead.'
    );
  }
}

export async function createAuthenticatedAgent() {
  assertIsolatedTestDatabase();
  const app = createApp();
  const agent = request.agent(app);

  userCounter += 1;
  const username = `tester${userCounter}`;
  const password = 'Sup3r-Strong-Passw0rd!';
  await services.authService.createUser(username, password);

  const csrfRes = await agent.get('/api/auth/csrf-token').expect(200);
  const csrfToken = csrfRes.body.csrfToken as string;

  await agent
    .post('/api/auth/login')
    .set('x-csrf-token', csrfToken)
    .send({ username, password })
    .expect(200);

  return { app, agent, csrfToken, username };
}

export async function resetDatabase() {
  assertIsolatedTestDatabase();
  await prisma.programHealthCheck.deleteMany();
  await prisma.apacheConfigRevision.deleteMany();
  await prisma.apacheBackup.deleteMany();
  await prisma.deviceToken.deleteMany();
  await prisma.device.deleteMany();
  await prisma.program.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
}
