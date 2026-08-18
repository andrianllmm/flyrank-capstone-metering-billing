import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { webhookService } from '../src/services/webhookService.js';
import { prisma } from '../src/lib/prisma.js';
import { quotaService } from '../src/services/quotaService.js';
import { createTestTenant, cleanupTenant } from './helpers/fixtures.js';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

function signPayload(payload: object): { body: Buffer; signature: string } {
  const body = Buffer.from(JSON.stringify(payload));
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload: body.toString(),
    secret: webhookSecret,
  });
  return { body, signature };
}

function buildEvent(type: string, data: object, id = `evt_${randomUUID()}`) {
  return {
    id,
    object: 'event',
    type,
    data: { object: data },
  };
}

describe('webhookService.handleStripeEvent', () => {
  let testTenant: Awaited<ReturnType<typeof createTestTenant>> | null = null;
  let proPlanId: string | null = null;
  const eventIdsToCleanup: string[] = [];

  afterEach(async () => {
    if (eventIdsToCleanup.length) {
      await prisma.processedStripeEvent.deleteMany({
        where: { stripeEventId: { in: eventIdsToCleanup } },
      });
      eventIdsToCleanup.length = 0;
    }
    if (testTenant) {
      await cleanupTenant(testTenant);
      testTenant = null;
    }
    if (proPlanId) {
      await prisma.plan.deleteMany({ where: { id: proPlanId } }).catch(() => {});
      proPlanId = null;
    }
  });

  it('no-ops on checkout.session.completed for an unrecognized tenant id, without throwing', async () => {
    const event = buildEvent('checkout.session.completed', {
      client_reference_id: 'not-a-real-tenant-id',
      subscription: `sub_${randomUUID()}`,
    });
    eventIdsToCleanup.push(event.id);

    const { body, signature } = signPayload(event);
    await expect(webhookService.handleStripeEvent(body, signature)).resolves.toBeUndefined();
  });

  it('no-ops on customer.subscription.deleted for an unrecognized subscription id, without throwing', async () => {
    const event = buildEvent('customer.subscription.deleted', { id: `sub_${randomUUID()}` });
    eventIdsToCleanup.push(event.id);

    const { body, signature } = signPayload(event);
    await expect(webhookService.handleStripeEvent(body, signature)).resolves.toBeUndefined();
  });

  it('rejects a payload with an invalid signature', async () => {
    const { body } = signPayload(buildEvent('checkout.session.completed', {}));
    await expect(webhookService.handleStripeEvent(body, 'bad-signature')).rejects.toThrow();
  });

  it('upserts an active subscription on checkout.session.completed and flips the tenant to pro', async () => {
    testTenant = await createTestTenant({ withSubscription: false });
    proPlanId = (
      await prisma.plan.upsert({
        where: { name: 'pro' },
        update: {},
        create: { name: 'pro', apiCallsLimit: 50_000, aiTokensLimit: 5_000_000 },
      })
    ).id;

    const stripeSubscriptionId = `sub_${randomUUID()}`;
    const event = buildEvent('checkout.session.completed', {
      client_reference_id: testTenant.tenant.id,
      subscription: stripeSubscriptionId,
    });
    eventIdsToCleanup.push(event.id);

    const { body, signature } = signPayload(event);
    await webhookService.handleStripeEvent(body, signature);

    const subscription = await prisma.subscription.findUnique({ where: { stripeSubscriptionId } });
    expect(subscription).not.toBeNull();
    expect(subscription?.tenantId).toBe(testTenant.tenant.id);
    expect(subscription?.planId).toBe(proPlanId);
    expect(subscription?.status).toBe('active');

    const result = await quotaService.check({
      tenantId: testTenant.tenant.id,
      type: 'api_call',
      quantity: 1,
    });
    expect(result).toEqual({ allowed: true });
  });

  it('processes a replayed event id exactly once', async () => {
    testTenant = await createTestTenant({ withSubscription: false });
    proPlanId = (
      await prisma.plan.upsert({
        where: { name: 'pro' },
        update: {},
        create: { name: 'pro', apiCallsLimit: 50_000, aiTokensLimit: 5_000_000 },
      })
    ).id;

    const stripeSubscriptionId = `sub_${randomUUID()}`;
    const event = buildEvent('checkout.session.completed', {
      client_reference_id: testTenant.tenant.id,
      subscription: stripeSubscriptionId,
    });
    eventIdsToCleanup.push(event.id);

    const { body, signature } = signPayload(event);
    await webhookService.handleStripeEvent(body, signature);
    await webhookService.handleStripeEvent(body, signature);

    const subscriptions = await prisma.subscription.findMany({ where: { stripeSubscriptionId } });
    expect(subscriptions).toHaveLength(1);

    const processedCount = await prisma.processedStripeEvent.count({
      where: { stripeEventId: event.id },
    });
    expect(processedCount).toBe(1);
  });

  it('reuses the tenant existing subscription row on checkout instead of creating a second one, so a later cancellation actually blocks access', async () => {
    testTenant = await createTestTenant({ apiCallsLimit: 1_000, aiTokensLimit: 100_000 });
    proPlanId = (
      await prisma.plan.upsert({
        where: { name: 'pro' },
        update: {},
        create: { name: 'pro', apiCallsLimit: 50_000, aiTokensLimit: 5_000_000 },
      })
    ).id;

    const stripeSubscriptionId = `sub_${randomUUID()}`;
    const checkoutEvent = buildEvent('checkout.session.completed', {
      client_reference_id: testTenant.tenant.id,
      subscription: stripeSubscriptionId,
    });
    eventIdsToCleanup.push(checkoutEvent.id);
    const checkoutSigned = signPayload(checkoutEvent);
    await webhookService.handleStripeEvent(checkoutSigned.body, checkoutSigned.signature);

    const rows = await prisma.subscription.findMany({ where: { tenantId: testTenant.tenant.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.planId).toBe(proPlanId);

    const cancelEvent = buildEvent('customer.subscription.deleted', { id: stripeSubscriptionId });
    eventIdsToCleanup.push(cancelEvent.id);
    const cancelSigned = signPayload(cancelEvent);
    await webhookService.handleStripeEvent(cancelSigned.body, cancelSigned.signature);

    const result = await quotaService.check({
      tenantId: testTenant.tenant.id,
      type: 'api_call',
      quantity: 1,
    });
    expect(result).toEqual({ allowed: false, reason: 'no_active_subscription' });
  });
});
