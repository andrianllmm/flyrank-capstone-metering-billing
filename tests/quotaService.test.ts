import { afterEach, describe, expect, it } from 'vitest';
import { quotaService } from '../src/services/quotaService.ts';
import { createTestTenant, cleanupTenant, seedUsage } from './helpers/fixtures.ts';

describe('quotaService.check', () => {
  let activeTenant: Awaited<ReturnType<typeof createTestTenant>> | null = null;

  afterEach(async () => {
    if (activeTenant) {
      await cleanupTenant(activeTenant);
      activeTenant = null;
    }
  });

  it('disallows with no_active_subscription when the tenant has no subscription', async () => {
    activeTenant = await createTestTenant({ withSubscription: false });
    const result = await quotaService.check({
      tenantId: activeTenant.tenant.id,
      type: 'api_call',
      quantity: 1,
    });
    expect(result).toEqual({ allowed: false, reason: 'no_active_subscription' });
  });

  it('disallows with no_active_subscription when the subscription is canceled', async () => {
    activeTenant = await createTestTenant({ subscriptionStatus: 'canceled' });
    const result = await quotaService.check({
      tenantId: activeTenant.tenant.id,
      type: 'api_call',
      quantity: 1,
    });
    expect(result).toEqual({ allowed: false, reason: 'no_active_subscription' });
  });

  it('allows a request exactly at the limit', async () => {
    activeTenant = await createTestTenant({ apiCallsLimit: 1 });
    const result = await quotaService.check({
      tenantId: activeTenant.tenant.id,
      type: 'api_call',
      quantity: 1,
    });
    expect(result).toEqual({ allowed: true });
  });

  it('disallows with quota_exceeded once usage plus the request goes over the limit', async () => {
    activeTenant = await createTestTenant({ apiCallsLimit: 1 });
    await seedUsage(activeTenant.tenant.id, 'api_call', 1);

    const result = await quotaService.check({
      tenantId: activeTenant.tenant.id,
      type: 'api_call',
      quantity: 1,
    });
    expect(result).toEqual({ allowed: false, reason: 'quota_exceeded', used: 1, limit: 1 });
  });

  it('checks api_call and ai_tokens against their own separate limits', async () => {
    activeTenant = await createTestTenant({ apiCallsLimit: 1, aiTokensLimit: 100 });
    await seedUsage(activeTenant.tenant.id, 'api_call', 1);

    const apiCallResult = await quotaService.check({
      tenantId: activeTenant.tenant.id,
      type: 'api_call',
      quantity: 1,
    });
    const tokensResult = await quotaService.check({
      tenantId: activeTenant.tenant.id,
      type: 'ai_tokens',
      quantity: 1,
    });

    expect(apiCallResult).toEqual({ allowed: false, reason: 'quota_exceeded', used: 1, limit: 1 });
    expect(tokensResult).toEqual({ allowed: true });
  });
});
