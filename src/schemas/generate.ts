import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { USAGE_TYPES } from '../lib/usageTypes.ts';
import { AuthorizationHeaderSchema } from './common.ts';

extendZodWithOpenApi(z);

export const GenerateHeadersSchema = z.object({
  authorization: AuthorizationHeaderSchema,
  'idempotency-key': z
    .string({ error: 'Missing Idempotency-Key header' })
    .min(1, 'Missing Idempotency-Key header')
    .openapi({ example: 'a1b2c3' }),
});

export const GenerateBodySchema = z.object({
  prompt: z
    .string({ error: 'Missing or invalid "prompt" in body' })
    .min(1, 'Missing or invalid "prompt" in body')
    .openapi({ example: 'Summarize this document.' }),
});

export const UsageEntrySchema = z.object({
  type: z.enum(USAGE_TYPES).openapi({ example: 'ai_tokens' }),
  quantity: z.number().int().openapi({ example: 10 }),
  costMicros: z.string().openapi({
    description: 'Integer cost in micros (1,000,000 = $1.00), as a string to preserve precision.',
    example: '195',
  }),
});

export const GenerateResponseSchema = z.object({
  output: z.string().openapi({ example: 'This is a simulated AI response.' }),
  usage: z.array(UsageEntrySchema),
});
