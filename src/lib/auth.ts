import type { Tenant } from '../generated/prisma/client.ts';
import { tenantRepository } from '../repositories/tenantRepository.ts';
import { hashApiKey } from './apiKey.ts';

export const NO_ACTIVE_SUBSCRIPTION_MESSAGE =
  'No active subscription. Upgrade or renew your plan to continue.';
export const INVALID_API_KEY_MESSAGE = 'Invalid API key';

export function resolveTenant(authorizationHeader: string): Promise<Tenant | null> {
  const apiKey = authorizationHeader.replace(/^Bearer\s+/, '');
  return tenantRepository.findByApiKeyHash(hashApiKey(apiKey));
}
