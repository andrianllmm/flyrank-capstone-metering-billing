import { prisma } from '../lib/prisma.js';
import type { ProcessedStripeEvent } from '../generated/prisma/client.js';

export const processedStripeEventRepository = {
  findById: (stripeEventId: string): Promise<ProcessedStripeEvent | null> => {
    return prisma.processedStripeEvent.findUnique({ where: { stripeEventId } });
  },
  create: (stripeEventId: string): Promise<ProcessedStripeEvent> => {
    return prisma.processedStripeEvent.create({ data: { stripeEventId } });
  },
};
