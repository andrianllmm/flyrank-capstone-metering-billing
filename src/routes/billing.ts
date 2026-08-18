import { Router } from 'express';

export const billingRouter = Router();

billingRouter.post('/billing/checkout', (_req, res) => {
  res.status(501).json({ status: 'error', message: 'Not implemented' });
});
