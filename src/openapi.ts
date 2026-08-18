import {
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  GenerateBodySchema,
  GenerateHeadersSchema,
  GenerateResponseSchema,
} from './schemas/generate.ts';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  description: 'Tenant API key, resolved server-side to a tenant.',
});

const ErrorResponse = registry.register(
  'ErrorResponse',
  z.object({
    status: z.literal('error').openapi({ example: 'error' }),
    message: z.string().openapi({ example: 'Missing Idempotency-Key header' }),
  }),
);

registry.registerPath({
  method: 'post',
  path: '/generate',
  summary: 'Dummy billable endpoint',
  description:
    'Records usage (api_call + ai_tokens, simulated from prompt length), enforces plan quota, and computes cost. No real model call is made.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    headers: GenerateHeadersSchema.omit({ authorization: true }),
    body: {
      content: {
        'application/json': {
          schema: GenerateBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Simulated generation succeeded; usage recorded and quota checked.',
      content: { 'application/json': { schema: GenerateResponseSchema } },
    },
    400: {
      description: 'Missing Idempotency-Key header or invalid/missing prompt.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    401: {
      description: 'Missing, malformed, or invalid API key.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    402: {
      description: 'No active subscription for the tenant.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    429: {
      description: 'Plan quota exceeded for this usage type this billing period.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Usage Metering & Billing Engine',
      version: '1.0.0',
      description: 'Meters usage, enforces plan quotas, calculates cost, and syncs with Stripe.',
    },
    servers: [{ url: process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}` }],
  });
}
