import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { createTestTenant, cleanupTenant, seedUsage } from './helpers/fixtures.js';

describe('cross-tenant isolation', () => {
  let tenantA: Awaited<ReturnType<typeof createTestTenant>> | null = null;
  let tenantB: Awaited<ReturnType<typeof createTestTenant>> | null = null;

  afterEach(async () => {
    if (tenantA) {
      await cleanupTenant(tenantA);
      tenantA = null;
    }
    if (tenantB) {
      await cleanupTenant(tenantB);
      tenantB = null;
    }
  });

  it("GET /usage for one tenant never reflects another tenant's usage", async () => {
    tenantA = await createTestTenant({ apiCallsLimit: 1_000, aiTokensLimit: 100_000 });
    tenantB = await createTestTenant({ apiCallsLimit: 1_000, aiTokensLimit: 100_000 });

    await seedUsage(tenantA.tenant.id, 'api_call', 3);
    await seedUsage(tenantB.tenant.id, 'api_call', 999);

    const resA = await request(app).get('/usage').set('Authorization', `Bearer ${tenantA.apiKey}`);
    const resB = await request(app).get('/usage').set('Authorization', `Bearer ${tenantB.apiKey}`);

    expect(resA.body.usage.find((u: { type: string }) => u.type === 'api_call').used).toBe(3);
    expect(resB.body.usage.find((u: { type: string }) => u.type === 'api_call').used).toBe(999);
  });

  it('the same idempotency key from two different tenants records two separate usage events, not a dedup collision', async () => {
    tenantA = await createTestTenant({ apiCallsLimit: 1_000, aiTokensLimit: 100_000 });
    tenantB = await createTestTenant({ apiCallsLimit: 1_000, aiTokensLimit: 100_000 });

    const sharedKey = 'shared-idempotency-key';
    const resA = await request(app)
      .post('/generate')
      .set('Authorization', `Bearer ${tenantA.apiKey}`)
      .set('Idempotency-Key', sharedKey)
      .send({ prompt: 'from tenant A' });
    const resB = await request(app)
      .post('/generate')
      .set('Authorization', `Bearer ${tenantB.apiKey}`)
      .set('Idempotency-Key', sharedKey)
      .send({ prompt: 'from tenant B' });

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const usageA = await request(app)
      .get('/usage')
      .set('Authorization', `Bearer ${tenantA.apiKey}`);
    const usageB = await request(app)
      .get('/usage')
      .set('Authorization', `Bearer ${tenantB.apiKey}`);

    expect(usageA.body.usage.find((u: { type: string }) => u.type === 'api_call').used).toBe(1);
    expect(usageB.body.usage.find((u: { type: string }) => u.type === 'api_call').used).toBe(1);
  });
});
