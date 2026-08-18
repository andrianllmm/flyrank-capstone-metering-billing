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
} from './schemas/generate.js';
import { UsageResponseSchema } from './schemas/usage.js';
import { CheckoutHeadersSchema, CheckoutResponseSchema } from './schemas/billing.js';
import { StripeWebhookHeadersSchema, WebhookResponseSchema } from './schemas/webhooks.js';

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

registry.registerPath({
  method: 'get',
  path: '/usage',
  summary: 'Current-period usage rollup',
  description: '{ used, limit, cost } per usage type for the current billing period.',
  security: [{ [bearerAuth.name]: [] }],
  responses: {
    200: {
      description: 'Rollup returned.',
      content: { 'application/json': { schema: UsageResponseSchema } },
    },
    401: {
      description: 'Missing, malformed, or invalid API key.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    402: {
      description: 'No active subscription for the tenant.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/billing/checkout',
  summary: 'Create a Stripe Checkout session',
  description: 'Creates a Stripe Checkout session for the tenant to upgrade to the pro plan.',
  security: [{ [bearerAuth.name]: [] }],
  request: {
    headers: CheckoutHeadersSchema.omit({ authorization: true }),
  },
  responses: {
    200: {
      description: 'Checkout session created.',
      content: { 'application/json': { schema: CheckoutResponseSchema } },
    },
    401: {
      description: 'Missing, malformed, or invalid API key.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    409: {
      description: 'Tenant already has an active pro subscription.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    502: {
      description: 'Failed to create checkout session with Stripe.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/webhooks/stripe',
  summary: 'Stripe webhook receiver',
  description:
    'Receives and verifies Stripe webhook events (checkout/session/subscription updates) using the raw request body and stripe-signature header.',
  request: {
    headers: StripeWebhookHeadersSchema,
    body: {
      content: {
        'application/json': {
          schema: z.string().openapi({ description: 'Raw Stripe event payload.' }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Event processed.',
      content: { 'application/json': { schema: WebhookResponseSchema } },
    },
    400: {
      description: 'Missing stripe-signature header or invalid signature.',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    500: {
      description: 'Webhook handling failed.',
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
