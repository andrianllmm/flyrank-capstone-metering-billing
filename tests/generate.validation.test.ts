import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { createTestTenant, cleanupTenant } from './helpers/fixtures.js';

describe('POST /generate validation', () => {
  let activeTenant: Awaited<ReturnType<typeof createTestTenant>> | null = null;

  afterEach(async () => {
    if (activeTenant) {
      await cleanupTenant(activeTenant);
      activeTenant = null;
    }
  });

  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).post('/generate').send({ prompt: 'hi' });
    expect(res.status).toBe(401);
  });

  it('rejects a request with no Idempotency-Key header', async () => {
    const res = await request(app)
      .post('/generate')
      .set('Authorization', 'Bearer whatever')
      .send({ prompt: 'hi' });
    expect(res.status).toBe(400);
  });

  it('rejects a request with a missing prompt', async () => {
    activeTenant = await createTestTenant();
    const res = await request(app)
      .post('/generate')
      .set('Authorization', `Bearer ${activeTenant.apiKey}`)
      .set('Idempotency-Key', randomUUID())
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects an unknown API key', async () => {
    const res = await request(app)
      .post('/generate')
      .set('Authorization', 'Bearer does-not-exist')
      .set('Idempotency-Key', randomUUID())
      .send({ prompt: 'hi' });
    expect(res.status).toBe(401);
  });
});
