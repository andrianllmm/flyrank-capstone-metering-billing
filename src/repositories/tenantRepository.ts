import { prisma } from '../lib/prisma.ts';
import type { Tenant } from '../generated/prisma/client.ts';

export const tenantRepository = {
  findByApiKeyHash: (apiKeyHash: string): Promise<Tenant | null> => {
    return prisma.tenant.findUnique({ where: { apiKeyHash } });
  },
};
