import { LLM_PROVIDER_DEFAULT_MODELS } from '@daoyou/contracts/llm/config';
import {
  AiModule,
  type AiModelDefinition,
  type AiModuleOptions,
} from '@nestjs/ai';
import { Module } from '@nestjs/common';
import {
  BulkheadPolicy,
  ResiliencePolicy,
  ResilienceTimeoutError,
  RetryPolicy,
  TimeoutPolicy,
} from '@nestjs/resilience';
import { AppConfigService } from '@server/config/app-config.service.js';
import { ConfigurationModule } from '@server/config/configuration.module.js';
import { LLM_PROVIDER_FACTORIES } from '@server/lib/llm/providers.js';
import { getAiPricingSettings } from '@server/lib/repositories/appSettingsRepository.js';
import { APICallError, type LanguageModel } from 'ai';
import { AiUsageModule } from './ai-usage.module.js';
import { AiUsageService } from './ai-usage.service.js';
import { getModelPricing, type ModelPricing } from './model-pricing.js';

const MAX_RETRY_DELAY_MS = 30_000;

// AiModule accepts one composed policy, so preserve provider retry hints when adding a bulkhead.
function retryAfterMs(error: unknown): number | undefined {
  if (!APICallError.isInstance(error) || !error.responseHeaders)
    return undefined;
  const headers = Object.fromEntries(
    Object.entries(error.responseHeaders).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );
  const milliseconds = Number.parseFloat(headers['retry-after-ms'] ?? '');
  if (Number.isFinite(milliseconds) && milliseconds >= 0) return milliseconds;
  const value = headers['retry-after'];
  if (value === undefined) return undefined;
  const seconds = Number.parseFloat(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

@Module({
  imports: [
    AiModule.forRootAsync({
      imports: [ConfigurationModule, AiUsageModule],
      inject: [AppConfigService, AiUsageService],
      useFactory: async (
        config: AppConfigService,
        usage: AiUsageService,
      ): Promise<AiModuleOptions> => {
        const pricingSettings = await getAiPricingSettings();
        const alibaba = LLM_PROVIDER_FACTORIES.alibaba.create({
          apiKey: config.get('ALIBABA_API_KEY')?.trim(),
        });
        const deepseek = LLM_PROVIDER_FACTORIES.deepseek.create({
          apiKey: config.get('DEEPSEEK_API_KEY')?.trim(),
        });
        const models: Record<string, AiModelDefinition> = {};
        const modelPrices = new Map<string, ModelPricing>();
        const bulkhead = new BulkheadPolicy({ maxConcurrent: 64, maxQueue: 0 });
        const registerModel = (name: string, model: LanguageModel) => {
          const price =
            typeof model === 'string'
              ? undefined
              : getModelPricing(model, pricingSettings);
          if (price) modelPrices.set(name, price);
          models[name] = {
            model,
            // A shared bulkhead holds its slot throughout retries and stream consumption.
            resilience: ResiliencePolicy.wrap(
              bulkhead,
              new RetryPolicy({
                attempts: 3,
                backoff: (attempt, error) =>
                  retryAfterMs(error) ??
                  Math.random() *
                    Math.min(MAX_RETRY_DELAY_MS, 1_000 * 2 ** (attempt - 1)),
                retryIf: (error) =>
                  (error instanceof ResilienceTimeoutError ||
                    (APICallError.isInstance(error) && error.isRetryable)) &&
                  (retryAfterMs(error) ?? 0) <= MAX_RETRY_DELAY_MS,
              }),
              new TimeoutPolicy(name.endsWith('.advanced') ? '15m' : '120s'),
            ),
            ...(price ? { pricing: price.pricing } : {}),
          };
        };
        registerModel(
          'alibaba.fast',
          alibaba(
            config.get('ALIBABA_FAST_MODEL')?.trim() ||
              LLM_PROVIDER_DEFAULT_MODELS.alibaba,
          ),
        );
        registerModel(
          'deepseek.fast',
          deepseek(
            config.get('DEEPSEEK_FAST_MODEL')?.trim() ||
              LLM_PROVIDER_DEFAULT_MODELS.deepseek,
          ),
        );
        const alibabaAdvanced = config.get('ALIBABA_ADVANCED_MODEL')?.trim();
        if (alibabaAdvanced) {
          registerModel('alibaba.advanced', alibaba(alibabaAdvanced));
        }
        const deepseekAdvanced = config.get('DEEPSEEK_ADVANCED_MODEL')?.trim();
        if (deepseekAdvanced) {
          registerModel('deepseek.advanced', deepseek(deepseekAdvanced));
        }
        return {
          models,
          defaults: {
            providerOptions: {
              alibaba: { enableThinking: false },
              deepseek: { thinking: { type: 'disabled' } },
            },
          },
          onUsage: (event) => {
            const price = event.model.name
              ? modelPrices.get(event.model.name)
              : undefined;
            return usage.record({
              sceneId: event.label,
              provider: event.model.provider,
              modelId: event.model.modelId,
              modelAlias: event.model.name,
              step: event.step,
              attempt: event.attempt,
              fallback: event.fallback,
              stream: event.stream,
              usage: event.usage,
              durationMs: event.durationMs,
              finishReason: event.finishReason,
              ...(price && event.cost !== undefined
                ? {
                    estimatedCost: event.cost,
                    currency: price.currency,
                    pricingSnapshot: {
                      ...price.pricing,
                      condition: price.condition,
                      source: price.source,
                    },
                  }
                : {}),
            });
          },
        };
      },
    }),
  ],
  exports: [AiModule],
})
export class LlmModule {}
