import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.ts';
import { prisma } from '../src/lib/prisma.ts';
import { createTestTenant, cleanupTenant, seedUsage } from './helpers/fixtures.ts';

describe('POST /generate', () => {
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

  it('records usage and returns cost on a valid request', async () => {
    activeTenant = await createTestTenant();
    const res = await request(app)
      .post('/generate')
      .set('Authorization', `Bearer ${activeTenant.apiKey}`)
      .set('Idempotency-Key', randomUUID())
      .send({ prompt: 'a'.repeat(20) });

    expect(res.status).toBe(200);
    expect(res.body.usage).toEqual([
      { type: 'api_call', quantity: 1, costMicros: '0' },
      { type: 'ai_tokens', quantity: 5, costMicros: '0' },
    ]);
  });

  it('does not double-count a retried request with the same idempotency key', async () => {
    activeTenant = await createTestTenant();
    const idempotencyKey = randomUUID();
    const payload = { prompt: 'retry me' };

    const first = await request(app)
      .post('/generate')
      .set('Authorization', `Bearer ${activeTenant.apiKey}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    const second = await request(app)
      .post('/generate')
      .set('Authorization', `Bearer ${activeTenant.apiKey}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);

    const rows = await prisma.usageEvent.findMany({
      where: { tenantId: activeTenant.tenant.id },
    });
    expect(rows).toHaveLength(2); // one api_call row + one ai_tokens row, no duplicates
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
