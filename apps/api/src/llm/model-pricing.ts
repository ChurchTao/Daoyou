import type { AiModelInfo, AiModelPricing } from '@nestjs/ai';
import { ALIBABA_DEFAULT_BASE_URL } from '@server/lib/llm/providers.js';

interface ModelPricing {
  pricing: AiModelPricing;
  currency: string;
  maxInputTokens: number;
  condition: string;
  source: string;
  verifiedAt: string;
}

// Native pricing is fixed per model. Only quote the verified input range;
// larger contexts, custom gateways and unknown models remain unpriced.
// Official prices are CNY per million tokens, excluding account discounts.
const QWEN_FLASH_PRICING: ModelPricing = {
  pricing: { input: 0.2, output: 0.8, cachedInput: 0.04 },
  currency: 'CNY',
  maxInputTokens: 32_000,
  condition:
    '北京实时 API、输入不超过 32000 Tokens、隐式缓存；不含优惠和免费额度',
  source: 'https://help.aliyun.com/zh/model-studio/model-pricing',
  verifiedAt: '2026-11-09',
};

export function getModelPricing(
  model: Pick<AiModelInfo, 'provider' | 'modelId'>,
  alibabaBaseUrl: string,
): ModelPricing | undefined {
  if (
    model.provider === 'alibaba.chat' &&
    model.modelId === 'qwen3.7-flash' &&
    alibabaBaseUrl.replace(/\/+$/, '') === ALIBABA_DEFAULT_BASE_URL
  ) {
    return QWEN_FLASH_PRICING;
  }
  return undefined;
}
