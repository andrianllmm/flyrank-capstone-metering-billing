import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { createTestTenant, cleanupTenant, seedUsage } from './helpers/fixtures.js';

describe('POST /generate quota', () => {
  let activeTenant: Awaited<ReturnType<typeof createTestTenant>> | null = null;

  afterEach(async () => {
    if (activeTenant) {
      await cleanupTenant(activeTenant);
      activeTenant = null;
    }
  });

  it('rejects with 402 when the tenant has no active subscription', async () => {
    activeTenant = await createTestTenant({ subscriptionStatus: 'canceled' });
    const res = await request(app)
      .post('/generate')
      .set('Authorization', `Bearer ${activeTenant.apiKey}`)
      .set('Idempotency-Key', randomUUID())
      .send({ prompt: 'hi' });
    expect(res.status).toBe(402);
  });

  it('allows a request exactly at the quota boundary', async () => {
    activeTenant = await createTestTenant({ apiCallsLimit: 1 });
    const res = await request(app)
      .post('/generate')
      .set('Authorization', `Bearer ${activeTenant.apiKey}`)
      .set('Idempotency-Key', randomUUID())
      .send({ prompt: 'hi' });
    expect(res.status).toBe(200);
  });

  it('rejects with 429 once the quota is exceeded', async () => {
    activeTenant = await createTestTenant({ apiCallsLimit: 1 });
    await seedUsage(activeTenant.tenant.id, 'api_call', 1);

    const res = await request(app)
      .post('/generate')
      .set('Authorization', `Bearer ${activeTenant.apiKey}`)
      .set('Idempotency-Key', randomUUID())
      .send({ prompt: 'hi' });
    expect(res.status).toBe(429);
  });
});
