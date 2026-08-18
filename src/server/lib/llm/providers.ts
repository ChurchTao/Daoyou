import { createAlibaba } from '@ai-sdk/alibaba';
import { createDeepSeek, deepSeek } from '@ai-sdk/deepseek';
import type { LanguageModel } from 'ai';
import {
  LLM_PROVIDER_DEFAULT_MODELS,
  type LlmProviderId,
} from '@shared/config/llm';

export interface LlmProviderDef {
  id: LlmProviderId;
  defaultModel: string;
  apiKeyEnv: string;
  create: (opts: {
    apiKey?: string;
    fetch?: typeof fetch;
  }) => (modelId: string) => LanguageModel;
}

const ALIBABA_BASE_URL =
  process.env.ALIBABA_BASE_URL?.trim() ||
  'https://dashscope.aliyuncs.com/compatible-mode/v1';

export const LLM_PROVIDERS: Record<LlmProviderId, LlmProviderDef> = {
  deepseek: {
    id: 'deepseek',
    defaultModel: LLM_PROVIDER_DEFAULT_MODELS.deepseek,
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    create: ({ apiKey, fetch }) =>
      apiKey || fetch ? createDeepSeek({ apiKey, fetch }) : deepSeek,
  },
  alibaba: {
    id: 'alibaba',
    defaultModel: LLM_PROVIDER_DEFAULT_MODELS.alibaba,
    apiKeyEnv: 'ALIBABA_API_KEY',
    create: ({ apiKey, fetch }) => {
      const provider = createAlibaba({
        apiKey,
        baseURL: ALIBABA_BASE_URL,
        fetch,
      });
      return (modelId: string) => provider(modelId);
    },
  },
};
