import { prisma } from '../lib/prisma.js';
import type { Plan, Subscription } from '../generated/prisma/client.js';

export const subscriptionRepository = {
  findActiveByTenantId: (tenantId: string): Promise<(Subscription & { plan: Plan }) | null> => {
    return prisma.subscription.findFirst({
      where: { tenantId, status: 'active' },
      include: { plan: true },
    });
  },
};
