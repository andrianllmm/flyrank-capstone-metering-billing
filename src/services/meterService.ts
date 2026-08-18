import type { UsageEvent, UsageType } from '../generated/prisma/client.ts';
import { usageEventRepository } from '../repositories/usageEventRepository.ts';
import { costService } from './costService.ts';

interface RecordUsageInput {
  tenantId: string;
  type: UsageType;
  quantity: number;
  idempotencyKey: string;
}

export const meterService = {
  record: async (input: RecordUsageInput): Promise<UsageEvent> => {
    const existing = await usageEventRepository.findByIdempotencyKey(
      input.tenantId,
      input.idempotencyKey,
    );
    if (existing) {
      return existing;
    }

    const costMicros = costService.calculate();

    return usageEventRepository.create({
      tenantId: input.tenantId,
      type: input.type,
      quantity: input.quantity,
      costMicros,
      idempotencyKey: input.idempotencyKey,
    });
  },
};
