/**
 * Token Counting Utility (Client-side)
 *
 * Provider-specific tokenization for accurate cost estimation.
 * Uses tiktoken/lite for Cloudflare Workers compatibility.
 *
 * | Provider   | Method                                      | Accuracy               |
 * |------------|---------------------------------------------|------------------------|
 * | OpenAI     | tiktoken with cl100k_base encoding          | Accurate               |
 * | Anthropic  | Character-based (~4 chars/token)            | Estimate               |
 * | Gemini     | Character-based (~4 chars/token)            | Estimate               |
 *
 * @see https://github.com/dqbd/tiktoken#cloudflare-workers
 */

import { getProviderFromModelId } from './model-pricing';

// Only import tiktoken on the client
let Tiktoken: typeof import('tiktoken/lite').Tiktoken | null = null;
let cl100k_base: {
  bpe_ranks: string;
  special_tokens: Record<string, number>;
  pat_str: string;
} | null = null;

// Encoder instance
let encoder: InstanceType<typeof import('tiktoken/lite').Tiktoken> | null =
  null;
let encoderLoaded = false;
let encoderInitPromise: Promise<void> | null = null;

const initEncoder = async () => {
  if (encoderLoaded || typeof window === 'undefined') return;
  if (encoderInitPromise) return encoderInitPromise;

  encoderInitPromise = (async () => {
    try {
      const tiktokenModule = await import('tiktoken/lite');
      const encoderData = await import('tiktoken/encoders/cl100k_base.json');

      Tiktoken = tiktokenModule.Tiktoken;
      cl100k_base = encoderData.default;

      if (Tiktoken && cl100k_base) {
        encoder = new Tiktoken(
          cl100k_base.bpe_ranks,
          cl100k_base.special_tokens,
          cl100k_base.pat_str,
        );
        encoderLoaded = true;
      }
    } catch (e) {
      console.warn('Failed to initialize tiktoken:', e);
    }
  })();

  return encoderInitPromise;
};

// Initialize encoder on client
if (typeof window !== 'undefined') {
  initEncoder();
}

/**
 * Count tokens for OpenAI models using tiktoken
 */
const countOpenAITokens = (text: string): number => {
  if (!encoderLoaded || !encoder) {
    // Fallback if encoder not available
    return Math.ceil(text.length / 4);
  }

  try {
    return encoder.encode(text).length;
  } catch {
    // Fallback on error
    return Math.ceil(text.length / 4);
  }
};

/**
 * Count tokens for Anthropic models
 * Uses character-based estimation (~4 chars per token)
 */
const countAnthropicTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

/**
 * Count tokens for Google models
 * Uses character-based estimation (~4 characters per token)
 */
const countGoogleTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

/**
 * Count tokens for a given text and model
 * @param text - The text to count tokens for
 * @param modelId - The model ID (e.g., 'gpt-4o', 'claude-sonnet-4')
 * @returns The estimated token count
 */
export const countTokens = (text: string, modelId: string): number => {
  if (!text) return 0;

  const provider = getProviderFromModelId(modelId);

  switch (provider) {
    case 'openai':
      return countOpenAITokens(text);
    case 'anthropic':
      return countAnthropicTokens(text);
    case 'google':
      return countGoogleTokens(text);
    default:
      return Math.ceil(text.length / 4);
  }
};

/**
 * Check if the token count is an estimate vs accurate
 * @param modelId - The model ID
 * @returns Whether the token count is an estimate
 */
export const isTokenCountEstimate = (modelId: string): boolean => {
  const provider = getProviderFromModelId(modelId);
  // OpenAI is accurate once tiktoken loads, others are always estimates
  if (provider === 'openai') {
    return !encoderLoaded;
  }
  return true;
};

/**
 * Get a simple character-based estimate
 * Useful as a quick fallback
 */
export const estimateTokens = (text: string): number => {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
};
