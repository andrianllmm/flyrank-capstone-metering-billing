import type { UsageEvent } from '../generated/prisma/client.js';
import { usageEventRepository } from '../repositories/usageEventRepository.js';
import { costService, type AiTokenBreakdown } from './costService.js';

type RecordUsageInput =
  | { tenantId: string; idempotencyKey: string; type: 'api_call'; quantity: number }
  | ({ tenantId: string; idempotencyKey: string; type: 'ai_tokens' } & AiTokenBreakdown);

export const meterService = {
  record: async (input: RecordUsageInput): Promise<UsageEvent> => {
    const existing = await usageEventRepository.findByIdempotencyKey(
      input.tenantId,
      input.idempotencyKey,
    );
    if (existing) {
      return existing;
    }

    if (input.type === 'api_call') {
      return usageEventRepository.create({
        tenantId: input.tenantId,
        type: 'api_call',
        quantity: input.quantity,
        costMicros: costService.calculate({ type: 'api_call', quantity: input.quantity }),
        idempotencyKey: input.idempotencyKey,
      });
    }

    const quantity = input.input + input.cachedInput + input.output + input.reasoning;
    return usageEventRepository.create({
      tenantId: input.tenantId,
      type: 'ai_tokens',
      quantity,
      costMicros: costService.calculate({
        type: 'ai_tokens',
        input: input.input,
        cachedInput: input.cachedInput,
        output: input.output,
        reasoning: input.reasoning,
      }),
      idempotencyKey: input.idempotencyKey,
    });
  },
};
