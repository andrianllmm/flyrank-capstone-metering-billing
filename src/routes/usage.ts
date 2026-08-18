import { Router } from 'express';

export const usageRouter = Router();

usageRouter.get('/usage', (_req, res) => {
  res.status(501).json({ status: 'error', message: 'Not implemented' });
});
