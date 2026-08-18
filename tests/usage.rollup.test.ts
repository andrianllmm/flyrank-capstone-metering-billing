import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { createTestTenant, cleanupTenant, seedUsage } from './helpers/fixtures.js';

describe('GET /usage rollup', () => {
  let activeTenant: Awaited<ReturnType<typeof createTestTenant>> | null = null;

  afterEach(async () => {
    if (activeTenant) {
      await cleanupTenant(activeTenant);
      activeTenant = null;
    }
  });

  it('rejects with 402 when the tenant has no active subscription', async () => {
    activeTenant = await createTestTenant({ withSubscription: false });
    const res = await request(app)
      .get('/usage')
      .set('Authorization', `Bearer ${activeTenant.apiKey}`);
    expect(res.status).toBe(402);
  });

  it('returns used, limit, and cost per usage type', async () => {
    activeTenant = await createTestTenant({ apiCallsLimit: 1_000, aiTokensLimit: 100_000 });
    await seedUsage(activeTenant.tenant.id, 'api_call', 3);
    await seedUsage(activeTenant.tenant.id, 'ai_tokens', 500);

    const res = await request(app)
      .get('/usage')
      .set('Authorization', `Bearer ${activeTenant.apiKey}`);

    expect(res.status).toBe(200);
    expect(res.body.usage).toEqual([
      { type: 'api_call', used: 3, limit: 1_000, costMicros: '0' },
      { type: 'ai_tokens', used: 500, limit: 100_000, costMicros: '0' },
    ]);
  });
});
