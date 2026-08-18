import express from 'express';
import { healthRouter } from './routes/health.js';
import { generateRouter } from './routes/generate.js';
import { usageRouter } from './routes/usage.js';
import { billingRouter } from './routes/billing.js';
import { webhooksRouter } from './routes/webhooks.js';
import { docsRouter } from './routes/docs.js';

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
app.use(docsRouter);

export default app;
