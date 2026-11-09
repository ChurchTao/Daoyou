import {
  DEFAULT_AI_MODEL_PRICING,
  type AiPricingSettings,
} from '@daoyou/contracts/admin/ai-pricing';
import type { AiModelInfo, AiModelPricing } from '@nestjs/ai';
import { APP_SETTING_KEYS } from '@server/lib/repositories/app-settings-config.js';

export interface ModelPricing {
  readonly pricing: AiModelPricing;
  readonly currency: string;
  readonly condition: string;
  readonly source: string;
}

export function getModelPricing(
  model: Pick<AiModelInfo, 'provider' | 'modelId'>,
  settings: AiPricingSettings,
): ModelPricing {
  const rule = settings.models.find(
    (candidate) =>
      candidate.provider === model.provider &&
      candidate.modelId === model.modelId,
  );
  const rates = rule ?? DEFAULT_AI_MODEL_PRICING;
  return Object.freeze({
    pricing: Object.freeze({
      input: rates.input,
      output: rates.output,
      ...(rule?.cachedInput !== undefined
        ? { cachedInput: rule.cachedInput }
        : {}),
    }),
    currency: rates.currency,
    condition: rule
      ? '管理员配置的每百万 tokens 估算价；本次 API 进程启动快照'
      : '默认每百万 tokens 估算价；本次 API 进程启动快照',
    source: rule ? `app_settings:${APP_SETTING_KEYS.aiModelPricing}` : 'default',
  });
}
