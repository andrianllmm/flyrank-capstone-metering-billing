import { prisma } from '../lib/prisma.ts';
import type { Plan, Subscription } from '../generated/prisma/client.ts';

export const subscriptionRepository = {
  findActiveByTenantId: (tenantId: string): Promise<(Subscription & { plan: Plan }) | null> => {
    return prisma.subscription.findFirst({
      where: { tenantId, status: 'active' },
      include: { plan: true },
    });
  },
};
