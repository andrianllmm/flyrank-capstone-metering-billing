import { API_CALL_PRICE_MICROS, AI_TOKEN_PRICE_MICROS } from '../config/pricing.ts';

export interface AiTokenBreakdown {
  input: number;
  cachedInput: number;
  output: number;
  reasoning: number;
}

export type CalculateCostInput =
  { type: 'api_call'; quantity: number } | ({ type: 'ai_tokens' } & AiTokenBreakdown);

export const costService = {
  calculate: (input: CalculateCostInput): bigint => {
    if (input.type === 'api_call') {
      return BigInt(input.quantity) * API_CALL_PRICE_MICROS;
    }

    // Reasoning tokens are billed at the output rate, not free or separate.
    return (
      BigInt(input.input) * AI_TOKEN_PRICE_MICROS.input +
      BigInt(input.cachedInput) * AI_TOKEN_PRICE_MICROS.cachedInput +
      BigInt(input.output + input.reasoning) * AI_TOKEN_PRICE_MICROS.output
    );
  },
};
