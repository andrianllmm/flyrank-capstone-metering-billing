import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { hashApiKey } from '../src/lib/apiKey.ts';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PLANS = {
  free: { name: 'free', apiCallsLimit: 1_000, aiTokensLimit: 100_000 },
  pro: { name: 'pro', apiCallsLimit: 50_000, aiTokensLimit: 5_000_000 },
} as const;

const TENANTS = {
  freeFresh: { name: 'Free Fresh', apiKey: 'seed-free-fresh-key' },
  freeNearLimit: { name: 'Free Near Limit', apiKey: 'seed-free-near-limit-key' },
  freeOverLimit: { name: 'Free Over Limit', apiKey: 'seed-free-over-limit-key' },
  pro: { name: 'Pro', apiKey: 'seed-pro-key' },
  lapsed: { name: 'Lapsed', apiKey: 'seed-lapsed-key' },
} as const;

async function upsertPlan(plan: (typeof PLANS)[keyof typeof PLANS]) {
  return prisma.plan.upsert({
    where: { name: plan.name },
    update: { apiCallsLimit: plan.apiCallsLimit, aiTokensLimit: plan.aiTokensLimit },
    create: plan,
  });
}

async function upsertTenant(tenant: (typeof TENANTS)[keyof typeof TENANTS]) {
  const apiKeyHash = hashApiKey(tenant.apiKey);
  return prisma.tenant.upsert({
    where: { apiKeyHash },
    update: { name: tenant.name },
    create: { name: tenant.name, apiKeyHash },
  });
}

async function upsertSubscription(params: {
  tenantId: string;
  planId: string;
  status: 'active' | 'past_due' | 'canceled';
}) {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const existing = await prisma.subscription.findFirst({ where: { tenantId: params.tenantId } });
  if (existing) {
    return prisma.subscription.update({
      where: { id: existing.id },
      data: { planId: params.planId, status: params.status },
    });
  }

  return prisma.subscription.create({
    data: {
      tenantId: params.tenantId,
      planId: params.planId,
      status: params.status,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
  });
}

async function upsertUsageEvent(params: {
  tenantId: string;
  type: 'api_call' | 'ai_tokens';
  quantity: number;
  idempotencyKey: string;
}) {
  return prisma.usageEvent.upsert({
    where: {
      tenantId_idempotencyKey: { tenantId: params.tenantId, idempotencyKey: params.idempotencyKey },
    },
    update: { quantity: params.quantity },
    create: {
      tenantId: params.tenantId,
      type: params.type,
      quantity: params.quantity,
      costMicros: 0n,
      idempotencyKey: params.idempotencyKey,
    },
  });
}

async function main() {
  const [freePlan, proPlan] = await Promise.all([upsertPlan(PLANS.free), upsertPlan(PLANS.pro)]);

  const [freeFresh, freeNearLimit, freeOverLimit, pro, lapsed] = await Promise.all([
    upsertTenant(TENANTS.freeFresh),
    upsertTenant(TENANTS.freeNearLimit),
    upsertTenant(TENANTS.freeOverLimit),
    upsertTenant(TENANTS.pro),
    upsertTenant(TENANTS.lapsed),
  ]);

  await Promise.all([
    // Free plan, active, no usage yet: baseline "everything under quota" case.
    upsertSubscription({ tenantId: freeFresh.id, planId: freePlan.id, status: 'active' }),

    // Free plan, active, 999/1,000 calls + 99,000/100,000 tokens used:
    // the next request should sit exactly at the boundary.
    upsertSubscription({ tenantId: freeNearLimit.id, planId: freePlan.id, status: 'active' }),

    // Free plan, active, already at 1,000/1,000 + 100,000/100,000: the
    // next request should be rejected with 429.
    upsertSubscription({ tenantId: freeOverLimit.id, planId: freePlan.id, status: 'active' }),

    // Pro plan, active, some usage: exercises the higher-limit path.
    upsertSubscription({ tenantId: pro.id, planId: proPlan.id, status: 'active' }),

    // Subscription exists but is canceled: the next request should be
    // rejected with 402, distinct from the 429 quota-exceeded case.
    upsertSubscription({ tenantId: lapsed.id, planId: freePlan.id, status: 'canceled' }),
  ]);

  await Promise.all([
    upsertUsageEvent({
      tenantId: freeNearLimit.id,
      type: 'api_call',
      quantity: 999,
      idempotencyKey: 'seed-usage-free-near-limit-api-call',
    }),
    upsertUsageEvent({
      tenantId: freeNearLimit.id,
      type: 'ai_tokens',
      quantity: 99_000,
      idempotencyKey: 'seed-usage-free-near-limit-ai-tokens',
    }),

    upsertUsageEvent({
      tenantId: freeOverLimit.id,
      type: 'api_call',
      quantity: 1_000,
      idempotencyKey: 'seed-usage-free-over-limit-api-call',
    }),
    upsertUsageEvent({
      tenantId: freeOverLimit.id,
      type: 'ai_tokens',
      quantity: 100_000,
      idempotencyKey: 'seed-usage-free-over-limit-ai-tokens',
    }),

    upsertUsageEvent({
      tenantId: pro.id,
      type: 'api_call',
      quantity: 500,
      idempotencyKey: 'seed-usage-pro-api-call',
    }),
    upsertUsageEvent({
      tenantId: pro.id,
      type: 'ai_tokens',
      quantity: 250_000,
      idempotencyKey: 'seed-usage-pro-ai-tokens',
    }),
  ]);

  console.log('Seeded plans, tenants, subscriptions, and usage events.');
  console.log('');
  console.log('Test API keys (plaintext, dev-only):');
  for (const [key, tenant] of Object.entries(TENANTS)) {
    console.log(`  ${key.padEnd(14)} ${tenant.apiKey}`);
  }
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
