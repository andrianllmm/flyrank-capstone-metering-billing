import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { USAGE_TYPES } from '../lib/usageTypes.js';
import { AuthorizationHeaderSchema } from './common.js';

extendZodWithOpenApi(z);

export const UsageHeadersSchema = z.object({
  authorization: AuthorizationHeaderSchema,
});

export const UsageRollupEntrySchema = z.object({
  type: z.enum(USAGE_TYPES).openapi({ example: 'ai_tokens' }),
  used: z.number().int().openapi({ example: 500 }),
  limit: z.number().int().openapi({ example: 100_000 }),
  costMicros: z.string().openapi({
    description: 'Integer cost in micros (1,000,000 = $1.00), as a string to preserve precision.',
    example: '5000',
  }),
});

export const UsageResponseSchema = z.object({
  usage: z.array(UsageRollupEntrySchema),
});
