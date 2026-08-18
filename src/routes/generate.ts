import { Router, type Response } from 'express';
import type { UsageType } from '../generated/prisma/client.ts';
import { hashApiKey } from '../lib/apiKey.ts';
import { tenantRepository } from '../repositories/tenantRepository.ts';
import { meterService } from '../services/meterService.ts';
import { quotaService, type QuotaCheckResult } from '../services/quotaService.ts';

export const generateRouter = Router();

// Rough token-count simulation (~4 chars/token)
function estimateTokenCount(prompt: string): number {
  return Math.max(1, Math.ceil(prompt.length / 4));
}

function respondQuotaExceeded(
  res: Response,
  result: Extract<QuotaCheckResult, { allowed: false }>,
  type: UsageType,
): void {
  if (result.reason === 'no_active_subscription') {
    res.status(402).json({
      status: 'error',
      message: 'No active subscription. Upgrade or renew your plan to continue.',
    });
    return;
  }

  res.status(429).json({
    status: 'error',
    message: `${type} quota exceeded: ${result.used}/${result.limit} used this period.`,
  });
}

generateRouter.post('/generate', async (req, res) => {
  const authHeader = req.header('authorization');
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!apiKey) {
    res.status(401).json({ status: 'error', message: 'Missing or invalid Authorization header' });
    return;
  }

  const idempotencyKey = req.header('idempotency-key');
  if (!idempotencyKey) {
    res.status(400).json({ status: 'error', message: 'Missing Idempotency-Key header' });
    return;
  }

  const prompt: unknown = req.body?.prompt;
  if (typeof prompt !== 'string' || prompt.length === 0) {
    res.status(400).json({ status: 'error', message: 'Missing or invalid "prompt" in body' });
    return;
  }

  const tenant = await tenantRepository.findByApiKeyHash(hashApiKey(apiKey));
  if (!tenant) {
    res.status(401).json({ status: 'error', message: 'Invalid API key' });
    return;
  }

  const tokenCount = estimateTokenCount(prompt);

  const apiCallQuota = await quotaService.check({
    tenantId: tenant.id,
    type: 'api_call',
    quantity: 1,
  });
  if (!apiCallQuota.allowed) {
    respondQuotaExceeded(res, apiCallQuota, 'api_call');
    return;
  }

  const aiTokensQuota = await quotaService.check({
    tenantId: tenant.id,
    type: 'ai_tokens',
    quantity: tokenCount,
  });
  if (!aiTokensQuota.allowed) {
    respondQuotaExceeded(res, aiTokensQuota, 'ai_tokens');
    return;
  }

  const [apiCallEvent, tokenEvent] = await Promise.all([
    meterService.record({
      tenantId: tenant.id,
      type: 'api_call',
      quantity: 1,
      idempotencyKey: `${idempotencyKey}:api_call`,
    }),
    meterService.record({
      tenantId: tenant.id,
      type: 'ai_tokens',
      quantity: tokenCount,
      idempotencyKey: `${idempotencyKey}:ai_tokens`,
    }),
  ]);

  res.status(200).json({
    output: 'This is a simulated AI response.',
    usage: [
      {
        type: apiCallEvent.type,
        quantity: apiCallEvent.quantity,
        costMicros: apiCallEvent.costMicros.toString(),
      },
      {
        type: tokenEvent.type,
        quantity: tokenEvent.quantity,
        costMicros: tokenEvent.costMicros.toString(),
      },
    ],
  });
});
