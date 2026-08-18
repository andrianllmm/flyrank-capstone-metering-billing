import { prisma } from '../lib/prisma.js';
import type { Tenant } from '../generated/prisma/client.js';

export const tenantRepository = {
  findByApiKeyHash: (apiKeyHash: string): Promise<Tenant | null> => {
    return prisma.tenant.findUnique({ where: { apiKeyHash } });
  },
  findById: (tenantId: string): Promise<Tenant | null> => {
    return prisma.tenant.findUnique({ where: { id: tenantId } });
  },
  updateStripeCustomerId: (tenantId: string, stripeCustomerId: string): Promise<Tenant> => {
    return prisma.tenant.update({ where: { id: tenantId }, data: { stripeCustomerId } });
  },
};
