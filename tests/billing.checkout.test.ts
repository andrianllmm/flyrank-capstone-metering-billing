import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import Stripe from 'stripe';

vi.mock('../src/lib/stripe.js', () => {
  let customerSeq = 0;
  return {
    stripe: {
      customers: {
        retrieve: vi.fn(async (id: string) => {
          if (id === 'cus_doesnotexist123') {
            throw new Stripe.errors.StripeInvalidRequestError({
              type: 'invalid_request_error',
              code: 'resource_missing',
              message: 'No such customer',
              statusCode: 404,
            });
          }
          return { id, deleted: false };
        }),
        create: vi.fn(async () => ({ id: `cus_test_${++customerSeq}` })),
      },
      checkout: {
        sessions: {
          create: vi.fn(async () => ({ url: 'https://checkout.stripe.com/test-session' })),
        },
      },
    },
  };
});

import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { createTestTenant, cleanupTenant } from './helpers/fixtures.js';

describe('POST /billing/checkout', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>> | null = null;
  let proPlanId: string | null = null;

  afterEach(async () => {
    if (testTenant) {
      await cleanupTenant(testTenant);
      testTenant = null;
    }
    if (proPlanId) {
      await prisma.plan.deleteMany({ where: { id: proPlanId } }).catch(() => {});
      proPlanId = null;
    }
  });

  it('rejects requests without a valid API key', async () => {
    const res = await request(app).post('/billing/checkout').set('Authorization', 'Bearer bogus');
    expect(res.status).toBe(401);
  });

  it('creates a checkout session and persists the stripe customer id', async () => {
    testTenant = await createTestTenant();

    const res = await request(app)
      .post('/billing/checkout')
      .set('Authorization', `Bearer ${testTenant.apiKey}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('checkout.stripe.com');

    const tenant = await prisma.tenant.findUnique({ where: { id: testTenant.tenant.id } });
    expect(tenant?.stripeCustomerId).toBeTruthy();
  });

  it('recovers when the tenant has a stripe customer id that no longer exists on Stripe', async () => {
    testTenant = await createTestTenant();
    await prisma.tenant.update({
      where: { id: testTenant.tenant.id },
      data: { stripeCustomerId: 'cus_doesnotexist123' },
    });

    const res = await request(app)
      .post('/billing/checkout')
      .set('Authorization', `Bearer ${testTenant.apiKey}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('checkout.stripe.com');

    const tenant = await prisma.tenant.findUnique({ where: { id: testTenant.tenant.id } });
    expect(tenant?.stripeCustomerId).toBeTruthy();
    expect(tenant?.stripeCustomerId).not.toBe('cus_doesnotexist123');
  });

  it('rejects with 409 when the tenant already has an active pro subscription', async () => {
    proPlanId = (
      await prisma.plan.upsert({
        where: { name: 'pro' },
        update: {},
        create: { name: 'pro', apiCallsLimit: 50_000, aiTokensLimit: 5_000_000 },
      })
    ).id;
    testTenant = await createTestTenant({ withSubscription: false });
    await prisma.subscription.create({
      data: {
        tenantId: testTenant.tenant.id,
        planId: proPlanId,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const res = await request(app)
      .post('/billing/checkout')
      .set('Authorization', `Bearer ${testTenant.apiKey}`);

    expect(res.status).toBe(409);
  });
});
