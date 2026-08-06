import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { services } from '../../../src/services/container';
import { resetDatabase } from './helpers';

describe('Auth API', () => {
  beforeEach(async () => {
    await resetDatabase();
  });
  afterEach(async () => {
    await resetDatabase();
  });

  it('logs in with correct credentials and exposes /auth/me', async () => {
    const app = createApp();
    await services.authService.createUser('loginuser', 'Sup3r-Strong-Passw0rd!');
    const agent = request.agent(app);

    const csrf = await agent.get('/api/auth/csrf-token').expect(200);
    await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrf.body.csrfToken)
      .send({ username: 'loginuser', password: 'Sup3r-Strong-Passw0rd!' })
      .expect(200);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.username).toBe('loginuser');
  });

  it('rejects an incorrect password without revealing whether the account exists', async () => {
    const app = createApp();
    await services.authService.createUser('lockuser', 'Sup3r-Strong-Passw0rd!');
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf-token').expect(200);

    const wrongUser = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrf.body.csrfToken)
      .send({ username: 'does-not-exist', password: 'whatever' })
      .expect(401);
    const wrongPass = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrf.body.csrfToken)
      .send({ username: 'lockuser', password: 'wrong-password' })
      .expect(401);

    expect(wrongUser.body.message).toBe(wrongPass.body.message);
  });

  it('locks the account out after the configured number of failed attempts', async () => {
    const app = createApp();
    await services.authService.createUser('lockuser2', 'Sup3r-Strong-Passw0rd!');
    const agent = request.agent(app);
    const csrf = await agent.get('/api/auth/csrf-token').expect(200);

    for (let i = 0; i < 5; i += 1) {
      await agent
        .post('/api/auth/login')
        .set('x-csrf-token', csrf.body.csrfToken)
        .send({ username: 'lockuser2', password: 'wrong-password' })
        .expect(401);
    }

    // Even the correct password must now be rejected because the account is locked.
    const stillLocked = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrf.body.csrfToken)
      .send({ username: 'lockuser2', password: 'Sup3r-Strong-Passw0rd!' })
      .expect(401);
    expect(stillLocked.body.message).toContain('잠겨');
  });
});
