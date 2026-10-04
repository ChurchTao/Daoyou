import { z } from 'zod';

export const LLM_PROVIDER_IDS = ['deepseek', 'alibaba'] as const;

export const LlmProviderIdSchema = z.enum(LLM_PROVIDER_IDS);

export type LlmProviderId = z.infer<typeof LlmProviderIdSchema>;

export const LLM_PROVIDER_DEFAULT_MODELS: Record<LlmProviderId, string> = {
  deepseek: 'deepseek-v4-flash',
  alibaba: 'qwen3.7-flash',
};

export const LlmByokConfigSchema = z
  .object({
    provider: LlmProviderIdSchema,
    apiKey: z.string().trim().min(1).max(512),
    model: z.string().trim().min(1).max(128),
  })
  .strict();

export type LlmByokConfig = z.infer<typeof LlmByokConfigSchema>;
