import Stripe from 'stripe';
import type { Tenant } from '../generated/prisma/client.js';
import { PRO_PLAN } from '../lib/plans.js';
import { stripe } from '../lib/stripe.js';
import { subscriptionRepository } from '../repositories/subscriptionRepository.js';
import { tenantRepository } from '../repositories/tenantRepository.js';

export type CreateCheckoutSessionResult = { status: 'ok'; url: string } | { status: 'already_pro' };

async function resolveStripeCustomerId(tenant: Tenant): Promise<string> {
  if (tenant.stripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(tenant.stripeCustomerId);
      if (!customer.deleted) {
        return tenant.stripeCustomerId;
      }
    } catch (err) {
      const isMissing =
        err instanceof Stripe.errors.StripeInvalidRequestError && err.code === 'resource_missing';
      if (!isMissing) {
        throw err;
      }
    }
  }

  const customer = await stripe.customers.create({ metadata: { tenantId: tenant.id } });
  await tenantRepository.updateStripeCustomerId(tenant.id, customer.id);
  return customer.id;
}

export const billingService = {
  createCheckoutSession: async (tenant: Tenant): Promise<CreateCheckoutSessionResult> => {
    const activeSubscription = await subscriptionRepository.findActiveByTenantId(tenant.id);
    if (activeSubscription?.plan.name === PRO_PLAN) {
      return { status: 'already_pro' };
    }

    const stripeCustomerId = await resolveStripeCustomerId(tenant);

    const envBaseUrl = process.env.BASE_URL;
    const baseUrl = envBaseUrl?.startsWith('http')
      ? envBaseUrl
      : `http://localhost:${process.env.PORT ?? 3000}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID_PRO!, quantity: 1 }],
      success_url: `${baseUrl}/billing/success`,
      cancel_url: `${baseUrl}/billing/cancel`,
      client_reference_id: tenant.id,
    });

    return { status: 'ok', url: session.url! };
  },
};
