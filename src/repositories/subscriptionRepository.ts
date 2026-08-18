import { prisma } from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Plan, Subscription, SubscriptionStatus } from '../generated/prisma/client.js';

export const subscriptionRepository = {
  findActiveByTenantId: (tenantId: string): Promise<(Subscription & { plan: Plan }) | null> => {
    return prisma.subscription.findFirst({
      where: { tenantId, status: 'active' },
      include: { plan: true },
    });
  },
  findByStripeSubscriptionId: (stripeSubscriptionId: string): Promise<Subscription | null> => {
    return prisma.subscription.findUnique({ where: { stripeSubscriptionId } });
  },
  // one Subscription row per tenant - update it, don't add a second one
  upsertForTenant: async (params: {
    tenantId: string;
    stripeSubscriptionId: string;
    planId: string;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  }): Promise<Subscription> => {
    const { tenantId, ...data } = params;
    const existing = await prisma.subscription.findFirst({ where: { tenantId } });
    if (existing) {
      return prisma.subscription.update({ where: { id: existing.id }, data });
    }
    return prisma.subscription.create({ data: { tenantId, ...data } });
  },
  updateStatusByStripeSubscriptionId: async (
    stripeSubscriptionId: string,
    status: SubscriptionStatus,
  ): Promise<Subscription | null> => {
    try {
      return await prisma.subscription.update({
        where: { stripeSubscriptionId },
        data: { status },
      });
    } catch (err) {
      // P2025: no subscription row for this id - no-op instead of 500ing back to Stripe
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return null;
      }
      throw err;
    }
  },
};
