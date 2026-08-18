import { Router } from 'express';

export const webhooksRouter = Router();

webhooksRouter.post('/webhooks/stripe', (_req, res) => {
  res.status(501).json({ status: 'error', message: 'Not implemented' });
});
