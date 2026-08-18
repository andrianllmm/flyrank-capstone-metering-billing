import { Router } from 'express';
import {
  INVALID_API_KEY_MESSAGE,
  NO_ACTIVE_SUBSCRIPTION_MESSAGE,
  resolveTenant,
} from '../lib/auth.ts';
import { usageService } from '../services/usageService.ts';
import { UsageHeadersSchema, UsageResponseSchema } from '../schemas/usage.ts';

export const usageRouter = Router();

usageRouter.get('/usage', async (req, res) => {
  const headers = UsageHeadersSchema.safeParse(req.headers);
  if (!headers.success) {
    res.status(401).json({ status: 'error', message: headers.error.issues[0]?.message });
    return;
  }

  const tenant = await resolveTenant(headers.data.authorization);
  if (!tenant) {
    res.status(401).json({ status: 'error', message: INVALID_API_KEY_MESSAGE });
    return;
  }

  const rollup = await usageService.getRollup(tenant.id);
  if (!rollup.hasSubscription) {
    res.status(402).json({ status: 'error', message: NO_ACTIVE_SUBSCRIPTION_MESSAGE });
    return;
  }

  const response = UsageResponseSchema.parse({
    usage: rollup.usage.map((entry) => ({
      type: entry.type,
      used: entry.used,
      limit: entry.limit,
      costMicros: entry.costMicros.toString(),
    })),
  });

  res.status(200).json(response);
});
