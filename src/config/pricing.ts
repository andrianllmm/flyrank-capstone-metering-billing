// Pinned pricing constants, in micros (1,000,000 micros = $1.00)

export const API_CALL_PRICE_MICROS = 500n; // $0.0005 per call

export const AI_TOKEN_PRICE_MICROS = {
  input: 3n, // $3.00 / 1M tokens
  cachedInput: 1n, // $1.00 / 1M tokens (cheaper than fresh input)
  output: 15n, // $15.00 / 1M tokens (reasoning tokens billed at this rate)
} as const;
