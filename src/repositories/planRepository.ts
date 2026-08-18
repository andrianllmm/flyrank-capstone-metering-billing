import { prisma } from '../lib/prisma.js';
import type { Plan } from '../generated/prisma/client.js';

export const planRepository = {
  findByName: (name: string): Promise<Plan | null> => {
    return prisma.plan.findUnique({ where: { name } });
  },
};
