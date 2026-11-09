import { createAlibaba } from '@ai-sdk/alibaba';
import { createDeepSeek } from '@ai-sdk/deepseek';
import type { LlmProviderId } from '@daoyou/contracts/llm/config';
import { getRuntimeEnvironment } from '@server/lib/config/environment.js';
import type { LanguageModel } from 'ai';
import { Agent } from 'undici';

// Long non-streaming generations can take over Node fetch's 300s header limit.
// Native policies and the caller's AbortSignal own the actual request deadline.
const modelAgent = new Agent({ headersTimeout: 0, bodyTimeout: 0 });
const modelFetch: typeof fetch = (input, init) =>
  globalThis.fetch(input, { ...init, dispatcher: modelAgent } as RequestInit);

export interface LlmProviderFactory {
  apiKeyEnv: string;
  create: (opts: {
    apiKey?: string;
    fetch?: typeof fetch;
  }) => (modelId: string) => LanguageModel;
}

export const ALIBABA_DEFAULT_BASE_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1';

const ALIBABA_BASE_URL =
  getRuntimeEnvironment().ALIBABA_BASE_URL?.trim() || ALIBABA_DEFAULT_BASE_URL;

export const LLM_PROVIDER_FACTORIES: Record<LlmProviderId, LlmProviderFactory> =
  {
    deepseek: {
      apiKeyEnv: 'DEEPSEEK_API_KEY',
      create: ({ apiKey, fetch = modelFetch }) =>
        createDeepSeek({ apiKey, fetch }),
    },
    alibaba: {
      apiKeyEnv: 'ALIBABA_API_KEY',
      create: ({ apiKey, fetch = modelFetch }) => {
        const provider = createAlibaba({
          apiKey,
          baseURL: ALIBABA_BASE_URL,
          fetch,
        });
        return (modelId: string) => provider(modelId);
      },
    },
  };
