import { Router } from 'express';
import { hashApiKey } from '../lib/apiKey.ts';
import { tenantRepository } from '../repositories/tenantRepository.ts';
import { meterService } from '../services/meterService.ts';

export const generateRouter = Router();

// Rough token-count simulation (~4 chars/token)
function estimateTokenCount(prompt: string): number {
  return Math.max(1, Math.ceil(prompt.length / 4));
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
      quantity: estimateTokenCount(prompt),
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
