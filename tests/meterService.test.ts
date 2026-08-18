import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { meterService } from '../src/services/meterService.js';
import { costService } from '../src/services/costService.js';
import { createTestTenant, cleanupTenant } from './helpers/fixtures.js';

describe('meterService.record', () => {
  let activeTenant: Awaited<ReturnType<typeof createTestTenant>> | null = null;

  afterEach(async () => {
    if (activeTenant) {
      await cleanupTenant(activeTenant);
      activeTenant = null;
    }
  });

  it('creates a usage event priced by costService', async () => {
    activeTenant = await createTestTenant();
    const event = await meterService.record({
      tenantId: activeTenant.tenant.id,
      idempotencyKey: randomUUID(),
      type: 'api_call',
      quantity: 3,
    });

    expect(event.quantity).toBe(3);
    expect(event.costMicros).toBe(costService.calculate({ type: 'api_call', quantity: 3 }));
  });

  it('sums an ai_tokens breakdown into a single quantity', async () => {
    activeTenant = await createTestTenant();
    const event = await meterService.record({
      tenantId: activeTenant.tenant.id,
      idempotencyKey: randomUUID(),
      type: 'ai_tokens',
      input: 4,
      cachedInput: 1,
      output: 10,
      reasoning: 3,
    });

    expect(event.quantity).toBe(18);
    expect(event.costMicros).toBe(
      costService.calculate({
        type: 'ai_tokens',
        input: 4,
        cachedInput: 1,
        output: 10,
        reasoning: 3,
      }),
    );
  });

  it('returns the existing event instead of inserting on a repeated idempotency key', async () => {
    activeTenant = await createTestTenant();
    const idempotencyKey = randomUUID();

    const first = await meterService.record({
      tenantId: activeTenant.tenant.id,
      idempotencyKey,
      type: 'api_call',
      quantity: 1,
    });
    const second = await meterService.record({
      tenantId: activeTenant.tenant.id,
      idempotencyKey,
      type: 'api_call',
      quantity: 1,
    });

    expect(second).toEqual(first);

    const rows = await prisma.usageEvent.findMany({
      where: { tenantId: activeTenant.tenant.id },
    });
    expect(rows).toHaveLength(1);
  });
});
