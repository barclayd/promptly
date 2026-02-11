import type { Provider } from './model-pricing';

export type LlmApiKey = {
  id: string;
  organizationId: string;
  name: string;
  provider: Provider;
  keyHint: string;
  enabledModels: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};
