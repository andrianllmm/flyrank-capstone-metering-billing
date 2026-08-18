import { prisma } from '../lib/prisma.ts';
import type { Prisma, UsageEvent } from '../generated/prisma/client.ts';

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
};
