import express from 'express';
import { healthRouter } from './routes/health.ts';

export const app = express();

app.get('/', (_req, res) => {
  res.status(200).json({ name: 'flyrank-capstone-metering-billing', status: 'ok' });
});

app.use(healthRouter);
