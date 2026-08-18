import { Router } from 'express';

export const generateRouter = Router();

generateRouter.post('/generate', (_req, res) => {
  res.status(501).json({ status: 'error', message: 'Not implemented' });
});
