import express from 'express';

export const app = express();

app.get('/', (_req, res) => {
  res.status(200).json({ name: 'flyrank-capstone-metering-billing', status: 'ok' });
});
