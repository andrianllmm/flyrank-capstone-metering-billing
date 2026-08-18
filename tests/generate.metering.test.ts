import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { app } from '../src/app.ts';
import { prisma } from '../src/lib/prisma.ts';
import { costService } from '../src/services/costService.ts';
import { createTestTenant, cleanupTenant } from './helpers/fixtures.ts';

describe('POST /generate metering', () => {
  let activeTenant: Awaited<ReturnType<typeof createTestTenant>> | null = null;

  afterEach(async () => {
    if (activeTenant) {
      await cleanupTenant(activeTenant);
      activeTenant = null;
    }
  });

  it('records usage and returns cost on a valid request', async () => {
    activeTenant = await createTestTenant();
    const res = await request(app)
      .post('/generate')
      .set('Authorization', `Bearer ${activeTenant.apiKey}`)
      .set('Idempotency-Key', randomUUID())
      .send({ prompt: 'a'.repeat(20) });

    // 20-char prompt -> 4 fresh input + 1 cached input + 10 output + 3 reasoning.
    const expectedApiCallCost = costService.calculate({ type: 'api_call', quantity: 1 });
    const expectedTokenCost = costService.calculate({
      type: 'ai_tokens',
      input: 4,
      cachedInput: 1,
      output: 10,
      reasoning: 3,
    });

    expect(res.status).toBe(200);
    expect(res.body.usage).toEqual([
      { type: 'api_call', quantity: 1, costMicros: expectedApiCallCost.toString() },
      { type: 'ai_tokens', quantity: 18, costMicros: expectedTokenCost.toString() },
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
});
