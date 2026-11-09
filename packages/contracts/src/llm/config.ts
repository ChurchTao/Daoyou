import { z } from 'zod';

export const LLM_PROVIDER_IDS = ['deepseek', 'alibaba'] as const;

export const LlmProviderIdSchema = z.enum(LLM_PROVIDER_IDS);

export type LlmProviderId = z.infer<typeof LlmProviderIdSchema>;

export const LLM_PROVIDER_DEFAULT_MODELS: Record<LlmProviderId, string> = {
  deepseek: 'deepseek-v4.1-flash',
  alibaba: 'qwen3.7-flash',
};
