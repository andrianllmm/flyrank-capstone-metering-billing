import { Router, type Response } from 'express';
import type { UsageType } from '../generated/prisma/client.ts';
import { hashApiKey } from '../lib/apiKey.ts';
import { tenantRepository } from '../repositories/tenantRepository.ts';
import { meterService } from '../services/meterService.ts';
import { quotaService, type QuotaCheckResult } from '../services/quotaService.ts';
import {
  GenerateBodySchema,
  GenerateHeadersSchema,
  GenerateResponseSchema,
} from '../schemas/generate.ts';

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
  const headers = GenerateHeadersSchema.safeParse(req.headers);
  if (!headers.success) {
    const authIssue = headers.error.issues.find((issue) => issue.path[0] === 'authorization');
    if (authIssue) {
      res.status(401).json({ status: 'error', message: authIssue.message });
      return;
    }
    res.status(400).json({ status: 'error', message: headers.error.issues[0]?.message });
    return;
  }

  const body = GenerateBodySchema.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ status: 'error', message: body.error.issues[0]?.message });
    return;
  }

  const apiKey = headers.data.authorization.replace(/^Bearer\s+/, '');
  const idempotencyKey = headers.data['idempotency-key'];
  const { prompt } = body.data;

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

  // Validated against the same schema openapi.ts documents, so a shape
  // mismatch (e.g. a forgotten costMicros.toString()) fails loudly here
  // instead of shipping silently.
  const response = GenerateResponseSchema.parse({
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

  res.status(200).json(response);
});
