/**
 * Token Counting Utility (Client-side)
 *
 * Character-based token estimation for cost calculation.
 * Real token counts come from the AI SDK after running tests.
 *
 * | Provider   | Chars/Token | Source                              |
 * |------------|-------------|-------------------------------------|
 * | OpenAI     | ~4          | OpenAI official documentation       |
 * | Anthropic  | ~3.5        | Anthropic recommendation            |
 * | Google     | ~4          | Google AI official documentation    |
 *
 * These estimates are used as fallbacks before a test is run.
 * Once a test completes, real token values from the API are used.
 */

import { getProviderFromModelId } from './model-pricing';

/** Characters per token by provider */
const CHARS_PER_TOKEN = {
  openai: 4,
  anthropic: 3.5,
  google: 4,
  default: 4,
} as const;

/**
 * Estimate tokens for OpenAI models
 * ~4 characters per token (official OpenAI documentation)
 */
const estimateOpenAITokens = (text: string): number => {
  return Math.ceil(text.length / CHARS_PER_TOKEN.openai);
};

/**
 * Estimate tokens for Anthropic models
 * ~3.5 characters per token (Anthropic recommendation)
 */
const estimateAnthropicTokens = (text: string): number => {
  return Math.ceil(text.length / CHARS_PER_TOKEN.anthropic);
};

/**
 * Estimate tokens for Google models
 * ~4 characters per token (Google AI official documentation)
 */
const estimateGoogleTokens = (text: string): number => {
  return Math.ceil(text.length / CHARS_PER_TOKEN.google);
};

/**
 * Count tokens for a given text and model
 * Uses character-based estimation - real values come from AI SDK after tests
 *
 * @param text - The text to count tokens for
 * @param modelId - The model ID (e.g., 'gpt-4o', 'claude-sonnet-4')
 * @returns The estimated token count
 */
export const countTokens = (text: string, modelId: string): number => {
  if (!text) return 0;

  const provider = getProviderFromModelId(modelId);

  switch (provider) {
    case 'openai':
      return estimateOpenAITokens(text);
    case 'anthropic':
      return estimateAnthropicTokens(text);
    case 'google':
      return estimateGoogleTokens(text);
    default:
      return Math.ceil(text.length / CHARS_PER_TOKEN.default);
  }
};

/**
 * Check if the token count is an estimate vs accurate
 * Character-based estimation is always an estimate.
 * Real accurate values come from the AI SDK after running a test.
 *
 * @param _modelId - The model ID (unused, kept for API compatibility)
 * @returns Always true since we use character-based estimation
 */
export const isTokenCountEstimate = (_modelId: string): boolean => {
  // Always an estimate - real values come from AI SDK after tests
  return true;
};

/**
 * Get a simple character-based estimate using default ratio
 * Useful as a quick fallback
 */
export const estimateTokens = (text: string): number => {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN.default);
};
