import { afterEach, describe, expect, it } from 'vitest';
import { usageService } from '../src/services/usageService.ts';
import { createTestTenant, cleanupTenant, seedUsage } from './helpers/fixtures.ts';

describe('usageService.getRollup', () => {
  let activeTenant: Awaited<ReturnType<typeof createTestTenant>> | null = null;

  afterEach(async () => {
    if (activeTenant) {
      await cleanupTenant(activeTenant);
      activeTenant = null;
    }
  });

  it('returns hasSubscription: false when the tenant has no active subscription', async () => {
    activeTenant = await createTestTenant({ withSubscription: false });
    const result = await usageService.getRollup(activeTenant.tenant.id);
    expect(result).toEqual({ hasSubscription: false });
  });

  it('returns zeroed usage for a tenant with no usage events', async () => {
    activeTenant = await createTestTenant({ apiCallsLimit: 1_000, aiTokensLimit: 100_000 });
    const result = await usageService.getRollup(activeTenant.tenant.id);

    expect(result).toEqual({
      hasSubscription: true,
      usage: [
        { type: 'api_call', used: 0, limit: 1_000, costMicros: 0n },
        { type: 'ai_tokens', used: 0, limit: 100_000, costMicros: 0n },
      ],
    });
  });

  it('sums usage and cost per type', async () => {
    activeTenant = await createTestTenant({ apiCallsLimit: 1_000, aiTokensLimit: 100_000 });
    await seedUsage(activeTenant.tenant.id, 'api_call', 3);
    await seedUsage(activeTenant.tenant.id, 'ai_tokens', 500);

    const result = await usageService.getRollup(activeTenant.tenant.id);

    expect(result).toEqual({
      hasSubscription: true,
      usage: [
        { type: 'api_call', used: 3, limit: 1_000, costMicros: 0n },
        { type: 'ai_tokens', used: 500, limit: 100_000, costMicros: 0n },
      ],
    });
  });
});
