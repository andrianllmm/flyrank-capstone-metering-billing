import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const StripeWebhookHeadersSchema = z.object({
  'stripe-signature': z
    .string({ error: 'Missing stripe-signature header' })
    .min(1, 'Missing stripe-signature header')
    .openapi({ example: 't=1690000000,v1=...' }),
});

export const WebhookResponseSchema = z.object({
  status: z.literal('ok').openapi({ example: 'ok' }),
});
