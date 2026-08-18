import express, { Router } from 'express';
import Stripe from 'stripe';
import { webhookService } from '../services/webhookService.js';
import { StripeWebhookHeadersSchema, WebhookResponseSchema } from '../schemas/webhooks.js';

export const webhooksRouter = Router();

webhooksRouter.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const headers = StripeWebhookHeadersSchema.safeParse(req.headers);
    if (!headers.success) {
      res.status(400).json({ status: 'error', message: headers.error.issues[0]?.message });
      return;
    }

    try {
      await webhookService.handleStripeEvent(req.body as Buffer, headers.data['stripe-signature']);
      res.status(200).json(WebhookResponseSchema.parse({ status: 'ok' }));
    } catch (err) {
      if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
        res.status(400).json({ status: 'error', message: 'Invalid signature' });
        return;
      }
      res.status(500).json({ status: 'error', message: 'Webhook handling failed' });
    }
  },
);
