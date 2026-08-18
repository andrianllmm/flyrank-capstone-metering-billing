import Stripe from 'stripe';
import { approximateMonthlyPeriod } from '../lib/billingPeriod.js';
import { PRO_PLAN } from '../lib/plans.js';
import { stripe } from '../lib/stripe.js';
import { planRepository } from '../repositories/planRepository.js';
import { processedStripeEventRepository } from '../repositories/processedStripeEventRepository.js';
import { subscriptionRepository } from '../repositories/subscriptionRepository.js';
import { tenantRepository } from '../repositories/tenantRepository.js';

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const tenantId = session.client_reference_id;
  const stripeSubscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (!tenantId || !stripeSubscriptionId) {
    return;
  }

  const tenant = await tenantRepository.findById(tenantId);
  if (!tenant) {
    // stale/foreign tenant id
    // no-op instead of 500ing back to Stripe
    return;
  }

  const plan = await planRepository.findByName(PRO_PLAN);
  if (!plan) {
    return;
  }

  await subscriptionRepository.upsertForTenant({
    tenantId,
    stripeSubscriptionId,
    planId: plan.id,
    status: 'active',
    ...approximateMonthlyPeriod(),
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const local = await subscriptionRepository.findByStripeSubscriptionId(subscription.id);
  if (!local) {
    return;
  }

  const item = subscription.items.data[0];
  const status = subscription.status === 'active' ? 'active' : 'past_due';

  const priceId = item?.price.id;
  let planId = local.planId;
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) {
    const plan = await planRepository.findByName(PRO_PLAN);
    if (plan) {
      planId = plan.id;
    }
  }

  await subscriptionRepository.upsertForTenant({
    tenantId: local.tenantId,
    stripeSubscriptionId: subscription.id,
    planId,
    status,
    currentPeriodStart: new Date((item?.current_period_start ?? subscription.start_date) * 1000),
    currentPeriodEnd: new Date((item?.current_period_end ?? subscription.start_date) * 1000),
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  await subscriptionRepository.updateStatusByStripeSubscriptionId(subscription.id, 'canceled');
}

export const webhookService = {
  handleStripeEvent: async (rawBody: Buffer, signature: string): Promise<void> => {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );

    const existing = await processedStripeEventRepository.findById(event.id);
    if (existing) {
      return;
    }
    await processedStripeEventRepository.create(event.id);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        break;
    }
  },
};
