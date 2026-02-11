import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { getProviderFromModelId, type Provider } from './model-pricing';

/**
 * Maps our display model IDs to the AI SDK model identifiers.
 * Most are the same, but some need transformation (e.g. dots to hyphens for Anthropic).
 */
const MODEL_ID_MAP: Record<string, string> = {
  // Anthropic: dots → hyphens
  'claude-opus-4.6': 'claude-opus-4-6-20250917',
  'claude-sonnet-4.5': 'claude-sonnet-4-5-20250929',
  'claude-haiku-4.5': 'claude-haiku-4-5-20251001',
  'claude-opus-4': 'claude-opus-4-20250514',
  'claude-sonnet-4': 'claude-sonnet-4-20250514',
  'claude-3.7-sonnet': 'claude-3-7-sonnet-20250219',
  // Google: our IDs → Gemini SDK model names
  'gemini-3-pro': 'gemini-3.0-pro',
  'gemini-3-flash': 'gemini-3.0-flash',
  'gemini-3-deep-think': 'gemini-3.0-deep-think',
  'gemini-2.5-pro': 'gemini-2.5-pro-latest',
  'gemini-2.5-flash': 'gemini-2.5-flash-preview-05-20',
};

const getSdkModelId = (modelId: string): string => {
  return MODEL_ID_MAP[modelId] ?? modelId;
};

export const createModelInstance = (
  modelId: string,
  apiKey: string,
  provider?: Provider,
): LanguageModel => {
  const resolvedProvider = provider ?? getProviderFromModelId(modelId);
  const sdkModelId = getSdkModelId(modelId);

  switch (resolvedProvider) {
    case 'anthropic': {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(sdkModelId);
    }
    case 'openai': {
      const openai = createOpenAI({ apiKey });
      return openai(sdkModelId);
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(sdkModelId);
    }
    default:
      throw new Error(`Unsupported provider: ${resolvedProvider}`);
  }
};
