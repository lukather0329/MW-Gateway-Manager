import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createAuthenticatedAgent, resetDatabase } from './helpers';

const validProgram = {
  name: '테스트 카메라',
  domain: 'camera.roboworks.co.kr',
  targetProtocol: 'http',
  targetHost: '127.0.0.1',
  targetPort: 3101,
  websocketEnabled: true,
  sslEnabled: true,
  healthCheckPath: '/api/health',
  enabled: true,
};

describe('Program API', () => {
  beforeEach(async () => {
    await resetDatabase();
  });
  afterEach(async () => {
    await resetDatabase();
  });

  it('registers a program with valid input', async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent();

    const res = await agent
      .post('/api/programs')
      .set('x-csrf-token', csrfToken)
      .send(validProgram)
      .expect(201);

    expect(res.body.program.domain).toBe('camera.roboworks.co.kr');
    expect(res.body.program.configFileName).toBe('camera.roboworks.co.kr.conf');
    expect(res.body.program.configStatus).toBe('NOT_APPLIED');
    expect(res.body.warnings).toEqual([]);
  });

  it('rejects registration without a valid CSRF token', async () => {
    const { agent } = await createAuthenticatedAgent();
    await agent.post('/api/programs').send(validProgram).expect(403);
  });

  it('rejects a duplicate domain', async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent();
    await agent.post('/api/programs').set('x-csrf-token', csrfToken).send(validProgram).expect(201);

    const res = await agent
      .post('/api/programs')
      .set('x-csrf-token', csrfToken)
      .send({ ...validProgram, name: '다른 이름' })
      .expect(400);

    expect(res.body.message).toContain('이미 등록된 도메인');
  });

  it('rejects a domain containing shell/path-traversal characters', async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent();
    const res = await agent
      .post('/api/programs')
      .set('x-csrf-token', csrfToken)
      .send({ ...validProgram, domain: '../../etc/passwd' })
      .expect(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('rejects an out-of-range port', async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent();
    await agent
      .post('/api/programs')
      .set('x-csrf-token', csrfToken)
      .send({ ...validProgram, targetPort: 70000 })
      .expect(400);
  });

  it('warns (but does not block) when the same port is reused on a different host', async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent();
    await agent.post('/api/programs').set('x-csrf-token', csrfToken).send(validProgram).expect(201);

    const res = await agent
      .post('/api/programs')
      .set('x-csrf-token', csrfToken)
      .send({ ...validProgram, domain: 'other.roboworks.co.kr', targetHost: '192.168.0.30' })
      .expect(201);

    expect(res.body.warnings.some((w: string) => w.includes('포트'))).toBe(true);
  });

  it('returns a config preview without writing anything to disk', async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent();
    const created = await agent
      .post('/api/programs')
      .set('x-csrf-token', csrfToken)
      .send(validProgram)
      .expect(201);

    const preview = await agent
      .post(`/api/programs/${created.body.program.id}/preview`)
      .set('x-csrf-token', csrfToken)
      .expect(200);

    expect(preview.body.content).toContain('ServerName camera.roboworks.co.kr');
    expect(preview.body.content).toContain('RewriteCond %{HTTP:Upgrade} =websocket');
    expect(preview.body.precheckIssues).toEqual([]);

    // Preview must be side-effect free: the program's config status is
    // still NOT_APPLIED and nothing should have been written.
    const detail = await agent.get(`/api/programs/${created.body.program.id}`).expect(200);
    expect(detail.body.configStatus).toBe('NOT_APPLIED');
  });

  it('applies a config successfully end to end (register -> preview -> apply)', async () => {
    const { agent, csrfToken } = await createAuthenticatedAgent();
    const created = await agent
      .post('/api/programs')
      .set('x-csrf-token', csrfToken)
      .send(validProgram)
      .expect(201);
    const id = created.body.program.id;

    await agent.post(`/api/programs/${id}/preview`).set('x-csrf-token', csrfToken).expect(200);

    const applyRes = await agent
      .post(`/api/programs/${id}/apply`)
      .set('x-csrf-token', csrfToken)
      .expect(200);

    expect(applyRes.body.outcome.success).toBe(true);
    expect(applyRes.body.configStatus).toBe('APPLIED');

    const detail = await agent.get(`/api/programs/${id}`).expect(200);
    expect(detail.body.configStatus).toBe('APPLIED');
  });

  it('rejects unauthenticated access', async () => {
    const { app } = await createAuthenticatedAgent();
    await request(app).get('/api/programs').expect(401);
  });
});
