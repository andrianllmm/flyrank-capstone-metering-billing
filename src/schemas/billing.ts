import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { AuthorizationHeaderSchema } from './common.js';

extendZodWithOpenApi(z);

export const CheckoutHeadersSchema = z.object({
  authorization: AuthorizationHeaderSchema,
});

export const CheckoutResponseSchema = z.object({
  status: z.literal('ok').openapi({ example: 'ok' }),
  url: z.string().openapi({ example: 'https://checkout.stripe.com/c/pay/cs_test_...' }),
});
