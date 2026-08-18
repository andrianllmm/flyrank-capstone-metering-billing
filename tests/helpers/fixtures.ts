import { randomUUID } from 'node:crypto';
import { hashApiKey } from '../../src/lib/apiKey.js';
import { prisma } from '../../src/lib/prisma.js';
import type { SubscriptionStatus, Tenant } from '../../src/generated/prisma/client.js';

interface TestTenant {
  tenant: Tenant;
  apiKey: string;
  planId: string | null;
}

export async function createTestTenant(
  options: {
    apiCallsLimit?: number;
    aiTokensLimit?: number;
    subscriptionStatus?: SubscriptionStatus;
    withSubscription?: boolean;
  } = {},
): Promise<TestTenant> {
  const apiKey = `test-key-${randomUUID()}`;
  const tenant = await prisma.tenant.create({
    data: { name: 'Test Tenant', apiKeyHash: hashApiKey(apiKey) },
  });

  if (options.withSubscription === false) {
    return { tenant, apiKey, planId: null };
  }

  const plan = await prisma.plan.create({
    data: {
      name: `test-plan-${randomUUID()}`,
      apiCallsLimit: options.apiCallsLimit ?? 1_000,
      aiTokensLimit: options.aiTokensLimit ?? 100_000,
    },
  });

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await prisma.subscription.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      status: options.subscriptionStatus ?? 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });

  return { tenant, apiKey, planId: plan.id };
}

export async function seedUsage(
  tenantId: string,
  type: 'api_call' | 'ai_tokens',
  quantity: number,
): Promise<void> {
  await prisma.usageEvent.create({
    data: {
      tenantId,
      type,
      quantity,
      costMicros: 0n,
      idempotencyKey: `seed-${randomUUID()}`,
    },
  });
}

export async function cleanupTenant({ tenant, planId }: TestTenant): Promise<void> {
  await prisma.usageEvent.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.subscription.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.tenant.delete({ where: { id: tenant.id } });
  if (planId) {
    await prisma.plan.delete({ where: { id: planId } });
  }
}
