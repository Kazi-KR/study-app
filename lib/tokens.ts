// Rough token estimator: ~4 chars per token for English.
// Good enough for budget checks; not used for billing.
export function approxTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
