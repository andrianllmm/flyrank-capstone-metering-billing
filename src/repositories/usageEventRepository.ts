import { prisma } from '../lib/prisma.ts';
import type { Prisma, UsageEvent, UsageType } from '../generated/prisma/client.ts';

export const usageEventRepository = {
  findByIdempotencyKey: (tenantId: string, idempotencyKey: string): Promise<UsageEvent | null> => {
    return prisma.usageEvent.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId: tenantId,
          idempotencyKey,
        },
      },
    });
  },
  create: (data: Prisma.UsageEventUncheckedCreateInput): Promise<UsageEvent> => {
    return prisma.usageEvent.create({ data });
  },
  sumQuantityByType: async (tenantId: string, type: UsageType, since: Date): Promise<number> => {
    const result = await prisma.usageEvent.aggregate({
      where: { tenantId, type, createdAt: { gte: since } },
      _sum: { quantity: true },
    });
    return result._sum.quantity ?? 0;
  },
};
