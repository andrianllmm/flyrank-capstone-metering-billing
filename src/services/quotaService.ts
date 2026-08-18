import type { UsageType } from '../generated/prisma/client.js';
import { subscriptionRepository } from '../repositories/subscriptionRepository.js';
import { usageEventRepository } from '../repositories/usageEventRepository.js';

interface CheckQuotaInput {
  tenantId: string;
  type: UsageType;
  quantity: number;
}

export type QuotaCheckResult =
  | { allowed: true }
  | { allowed: false; reason: 'no_active_subscription' }
  | { allowed: false; reason: 'quota_exceeded'; used: number; limit: number };

export const quotaService = {
  check: async (input: CheckQuotaInput): Promise<QuotaCheckResult> => {
    const subscription = await subscriptionRepository.findActiveByTenantId(input.tenantId);
    if (!subscription) {
      return { allowed: false, reason: 'no_active_subscription' };
    }

    const limit =
      input.type === 'api_call' ? subscription.plan.apiCallsLimit : subscription.plan.aiTokensLimit;

    const used = await usageEventRepository.sumQuantityByType(
      input.tenantId,
      input.type,
      subscription.currentPeriodStart,
    );

    if (used + input.quantity > limit) {
      return { allowed: false, reason: 'quota_exceeded', used, limit };
    }

    return { allowed: true };
  },
};
