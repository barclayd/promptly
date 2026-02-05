/**
 * Model Pricing Data
 *
 * Prices are in USD per 1 million tokens.
 * Data source: https://www.llm-prices.com/
 *
 * To update prices:
 * 1. Visit https://www.llm-prices.com/ or the provider's official pricing page
 * 2. Update the relevant model entry in MODEL_PRICING
 * 3. If adding a new model, add it to MODEL_PRICING and update select-scrollable.tsx
 *
 * Last updated: January 2025
 */

export type Provider = 'openai' | 'anthropic' | 'google';

export type ModelPricing = {
  id: string;
  displayName: string;
  provider: Provider;
  /** Input price per 1M tokens (USD) */
  inputPrice: number;
  /** Cached input price per 1M tokens (USD) */
  cachedInputPrice: number;
  /** Output price per 1M tokens (USD) */
  outputPrice: number;
};

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI Models
  'gpt-5.2-pro': {
    id: 'gpt-5.2-pro',
    displayName: 'GPT-5.2 Pro',
    provider: 'openai',
    inputPrice: 21.0,
    cachedInputPrice: 2.1,
    outputPrice: 168.0,
  },
  'gpt-5.2-thinking': {
    id: 'gpt-5.2-thinking',
    displayName: 'GPT-5.2 Thinking',
    provider: 'openai',
    inputPrice: 1.75,
    cachedInputPrice: 0.175,
    outputPrice: 14.0,
  },
  'gpt-5.2-instant': {
    id: 'gpt-5.2-instant',
    displayName: 'GPT-5.2 Instant',
    provider: 'openai',
    inputPrice: 1.75,
    cachedInputPrice: 0.175,
    outputPrice: 14.0,
  },
  'gpt-5.2-codex': {
    id: 'gpt-5.2-codex',
    displayName: 'GPT-5.2 Codex',
    provider: 'openai',
    inputPrice: 1.75,
    cachedInputPrice: 0.175,
    outputPrice: 14.0,
  },
  'gpt-5.1-codex-max': {
    id: 'gpt-5.1-codex-max',
    displayName: 'GPT-5.1 Codex Max',
    provider: 'openai',
    inputPrice: 1.25,
    cachedInputPrice: 0.125,
    outputPrice: 10.0,
  },
  'gpt-5-codex-mini': {
    id: 'gpt-5-codex-mini',
    displayName: 'GPT-5 Codex Mini',
    provider: 'openai',
    inputPrice: 0.25,
    cachedInputPrice: 0.025,
    outputPrice: 2.0,
  },
  'o4-mini': {
    id: 'o4-mini',
    displayName: 'o4-mini',
    provider: 'openai',
    inputPrice: 1.1,
    cachedInputPrice: 0.275,
    outputPrice: 4.4,
  },
  'gpt-4o': {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    inputPrice: 2.5,
    cachedInputPrice: 1.25,
    outputPrice: 10.0,
  },

  // Anthropic Models
  'claude-opus-4.6': {
    id: 'claude-opus-4.6',
    displayName: 'Claude Opus 4.6',
    provider: 'anthropic',
    inputPrice: 5.0,
    cachedInputPrice: 0.5,
    outputPrice: 25.0,
  },
  'claude-sonnet-4.5': {
    id: 'claude-sonnet-4.5',
    displayName: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    inputPrice: 3.0,
    cachedInputPrice: 0.3,
    outputPrice: 15.0,
  },
  'claude-haiku-4.5': {
    id: 'claude-haiku-4.5',
    displayName: 'Claude Haiku 4.5',
    provider: 'anthropic',
    inputPrice: 1.0,
    cachedInputPrice: 0.1,
    outputPrice: 5.0,
  },
  'claude-opus-4.1': {
    id: 'claude-opus-4.1',
    displayName: 'Claude Opus 4.1',
    provider: 'anthropic',
    inputPrice: 15.0,
    cachedInputPrice: 1.5,
    outputPrice: 75.0,
  },
  'claude-opus-4': {
    id: 'claude-opus-4',
    displayName: 'Claude Opus 4',
    provider: 'anthropic',
    inputPrice: 15.0,
    cachedInputPrice: 1.5,
    outputPrice: 75.0,
  },
  'claude-sonnet-4': {
    id: 'claude-sonnet-4',
    displayName: 'Claude Sonnet 4',
    provider: 'anthropic',
    inputPrice: 3.0,
    cachedInputPrice: 0.3,
    outputPrice: 15.0,
  },
  'claude-3.7-sonnet': {
    id: 'claude-3.7-sonnet',
    displayName: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    inputPrice: 3.0,
    cachedInputPrice: 0.3,
    outputPrice: 15.0,
  },

  // Google Models
  'gemini-3-pro': {
    id: 'gemini-3-pro',
    displayName: 'Gemini 3 Pro',
    provider: 'google',
    inputPrice: 2.0,
    cachedInputPrice: 0.2,
    outputPrice: 12.0,
  },
  'gemini-3-flash': {
    id: 'gemini-3-flash',
    displayName: 'Gemini 3 Flash',
    provider: 'google',
    inputPrice: 0.5,
    cachedInputPrice: 0.05,
    outputPrice: 3.0,
  },
  'gemini-3-deep-think': {
    id: 'gemini-3-deep-think',
    displayName: 'Gemini 3 Deep Think',
    provider: 'google',
    inputPrice: 2.0,
    cachedInputPrice: 0.2,
    outputPrice: 12.0,
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'google',
    inputPrice: 1.25,
    cachedInputPrice: 0.125,
    outputPrice: 10.0,
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'google',
    inputPrice: 0.3,
    cachedInputPrice: 0.03,
    outputPrice: 2.5,
  },
};

export const getProviderFromModelId = (modelId: string): Provider => {
  if (modelId.startsWith('gpt') || modelId.startsWith('o4')) {
    return 'openai';
  }
  if (modelId.startsWith('claude')) {
    return 'anthropic';
  }
  if (modelId.startsWith('gemini')) {
    return 'google';
  }
  // Default to OpenAI if unknown
  return 'openai';
};

export const getModelPricing = (modelId: string): ModelPricing | null => {
  return MODEL_PRICING[modelId] ?? null;
};

export const getAllModels = (): ModelPricing[] => {
  return Object.values(MODEL_PRICING);
};

export const getModelsByProvider = (provider: Provider): ModelPricing[] => {
  return Object.values(MODEL_PRICING).filter(
    (model) => model.provider === provider,
  );
};

/**
 * Calculate the cost for a given number of tokens
 * @param tokens - Number of tokens
 * @param pricePerMillion - Price per 1 million tokens (USD)
 * @returns Cost in USD
 */
export const calculateTokenCost = (
  tokens: number,
  pricePerMillion: number,
): number => {
  return (tokens * pricePerMillion) / 1_000_000;
};
