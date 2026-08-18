import { Router } from 'express';
import { INVALID_API_KEY_MESSAGE, resolveTenant } from '../lib/auth.js';
import { billingService } from '../services/billingService.js';
import { CheckoutHeadersSchema, CheckoutResponseSchema } from '../schemas/billing.js';

export const billingRouter = Router();

billingRouter.post('/billing/checkout', async (req, res) => {
  const headers = CheckoutHeadersSchema.safeParse(req.headers);
  if (!headers.success) {
    res.status(401).json({ status: 'error', message: headers.error.issues[0]?.message });
    return;
  }

  const tenant = await resolveTenant(headers.data.authorization);
  if (!tenant) {
    res.status(401).json({ status: 'error', message: INVALID_API_KEY_MESSAGE });
    return;
  }

  try {
    const result = await billingService.createCheckoutSession(tenant);
    if (result.status === 'already_pro') {
      res
        .status(409)
        .json({ status: 'error', message: 'Tenant already has an active pro subscription' });
      return;
    }
    res.status(200).json(CheckoutResponseSchema.parse({ status: 'ok', url: result.url }));
  } catch (err) {
    console.error('Failed to create checkout session', err);
    res.status(502).json({ status: 'error', message: 'Failed to create checkout session' });
  }
});

billingRouter.get('/billing/success', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Checkout complete. The webhook will flip your plan to Pro once Stripe processes it.',
  });
});

billingRouter.get('/billing/cancel', (_req, res) => {
  res.status(200).json({ status: 'ok', message: 'Checkout canceled. Your plan is unchanged.' });
});
