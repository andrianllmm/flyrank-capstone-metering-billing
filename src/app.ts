import express from 'express';
import { healthRouter } from './routes/health.ts';
import { generateRouter } from './routes/generate.ts';
import { usageRouter } from './routes/usage.ts';
import { billingRouter } from './routes/billing.ts';
import { webhooksRouter } from './routes/webhooks.ts';

export const app = express();

app.use(express.json());

app.get('/', (_req, res) => {
  res.status(200).json({ name: 'flyrank-capstone-metering-billing', status: 'ok' });
});

app.use(healthRouter);
app.use(generateRouter);
app.use(usageRouter);
app.use(billingRouter);
app.use(webhooksRouter);
