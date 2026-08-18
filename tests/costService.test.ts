import { describe, expect, it } from 'vitest';
import { costService } from '../src/services/costService.js';
import { API_CALL_PRICE_MICROS, AI_TOKEN_PRICE_MICROS } from '../src/config/pricing.js';

describe('costService.calculate', () => {
  it('prices an api_call as quantity * the pinned per-call rate', () => {
    const cost = costService.calculate({ type: 'api_call', quantity: 3 });
    expect(cost).toBe(3n * API_CALL_PRICE_MICROS);
  });

  it('prices fresh input tokens at the input rate', () => {
    const cost = costService.calculate({
      type: 'ai_tokens',
      input: 100,
      cachedInput: 0,
      output: 0,
      reasoning: 0,
    });
    expect(cost).toBe(100n * AI_TOKEN_PRICE_MICROS.input);
  });

  it('prices cached input tokens cheaper than fresh input', () => {
    const freshCost = costService.calculate({
      type: 'ai_tokens',
      input: 100,
      cachedInput: 0,
      output: 0,
      reasoning: 0,
    });
    const cachedCost = costService.calculate({
      type: 'ai_tokens',
      input: 0,
      cachedInput: 100,
      output: 0,
      reasoning: 0,
    });
    expect(cachedCost).toBeLessThan(freshCost);
    expect(cachedCost).toBe(100n * AI_TOKEN_PRICE_MICROS.cachedInput);
  });

  it('bills reasoning tokens at the output rate, not free or separate', () => {
    const outputOnly = costService.calculate({
      type: 'ai_tokens',
      input: 0,
      cachedInput: 0,
      output: 100,
      reasoning: 0,
    });
    const reasoningOnly = costService.calculate({
      type: 'ai_tokens',
      input: 0,
      cachedInput: 0,
      output: 0,
      reasoning: 100,
    });
    expect(reasoningOnly).toBe(outputOnly);
    expect(reasoningOnly).toBe(100n * AI_TOKEN_PRICE_MICROS.output);
  });

  it('does not simply sum all token categories at one flat rate', () => {
    const cost = costService.calculate({
      type: 'ai_tokens',
      input: 100,
      cachedInput: 100,
      output: 100,
      reasoning: 100,
    });
    const flatRateGuess = 400n * AI_TOKEN_PRICE_MICROS.input;
    expect(cost).not.toBe(flatRateGuess);
    expect(cost).toBe(
      100n * AI_TOKEN_PRICE_MICROS.input +
        100n * AI_TOKEN_PRICE_MICROS.cachedInput +
        200n * AI_TOKEN_PRICE_MICROS.output,
    );
  });
});
