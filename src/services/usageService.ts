import type { UsageType } from '../generated/prisma/client.ts';
import { USAGE_TYPES } from '../lib/usageTypes.ts';
import { subscriptionRepository } from '../repositories/subscriptionRepository.ts';
import { usageEventRepository } from '../repositories/usageEventRepository.ts';

interface UsageRollupEntry {
  type: UsageType;
  used: number;
  limit: number;
  costMicros: bigint;
}

export type UsageRollupResult =
  { hasSubscription: true; usage: UsageRollupEntry[] } | { hasSubscription: false };

export const usageService = {
  getRollup: async (tenantId: string): Promise<UsageRollupResult> => {
    const subscription = await subscriptionRepository.findActiveByTenantId(tenantId);
    if (!subscription) {
      return { hasSubscription: false };
    }

    const usage = await Promise.all(
      USAGE_TYPES.map(async (type) => {
        const { quantity, costMicros } = await usageEventRepository.sumByType(
          tenantId,
          type,
          subscription.currentPeriodStart,
        );
        const limit =
          type === 'api_call' ? subscription.plan.apiCallsLimit : subscription.plan.aiTokensLimit;
        return { type, used: quantity, limit, costMicros };
      }),
    );

    return { hasSubscription: true, usage };
  },
};
