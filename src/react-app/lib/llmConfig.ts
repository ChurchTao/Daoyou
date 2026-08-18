import {
  LlmByokConfigSchema,
  type LlmByokConfig,
} from '@shared/config/llm';

export const LLM_STORAGE_KEY = 'daoyou_llm_config';

export function readStoredLlmConfig(
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): LlmByokConfig | null {
  try {
    const raw = storage.getItem(LLM_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const provider =
      typeof parsed.provider === 'string' ? parsed.provider : 'deepseek';

    const config = LlmByokConfigSchema.safeParse({
      provider,
      apiKey: parsed.apiKey,
      model: parsed.model,
    });
    return config.success ? config.data : null;
  } catch {
    return null;
  }
}
