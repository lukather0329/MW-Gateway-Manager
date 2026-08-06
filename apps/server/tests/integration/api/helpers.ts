import request from 'supertest';
import { createApp } from '../../../src/app';
import { prisma } from '../../../src/config/prisma';
import { services } from '../../../src/services/container';

let userCounter = 0;

export async function createAuthenticatedAgent() {
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
  await prisma.programHealthCheck.deleteMany();
  await prisma.apacheConfigRevision.deleteMany();
  await prisma.apacheBackup.deleteMany();
  await prisma.deviceToken.deleteMany();
  await prisma.device.deleteMany();
  await prisma.program.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
}
