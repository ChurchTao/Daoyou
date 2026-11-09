import { LLM_PROVIDER_DEFAULT_MODELS } from '@daoyou/contracts/llm/config';
import {
  AiModule,
  type AiModelDefinition,
  type AiModuleOptions,
} from '@nestjs/ai';
import { Module } from '@nestjs/common';
import { AppConfigService } from '@server/config/app-config.service.js';
import { ConfigurationModule } from '@server/config/configuration.module.js';
import {
  ALIBABA_DEFAULT_BASE_URL,
  LLM_PROVIDER_FACTORIES,
} from '@server/lib/llm/providers.js';
import type { LanguageModel } from 'ai';
import { AiUsageModule } from './ai-usage.module.js';
import { AiUsageService } from './ai-usage.service.js';
import { getModelPricing } from './model-pricing.js';

@Module({
  imports: [
    AiModule.forRootAsync({
      imports: [ConfigurationModule, AiUsageModule],
      inject: [AppConfigService, AiUsageService],
      useFactory: (
        config: AppConfigService,
        usage: AiUsageService,
      ): AiModuleOptions => {
        const alibabaBaseUrl =
          config.get('ALIBABA_BASE_URL')?.trim() || ALIBABA_DEFAULT_BASE_URL;
        const alibaba = LLM_PROVIDER_FACTORIES.alibaba.create({
          apiKey: config.get('ALIBABA_API_KEY')?.trim(),
        });
        const deepseek = LLM_PROVIDER_FACTORIES.deepseek.create({
          apiKey: config.get('DEEPSEEK_API_KEY')?.trim(),
        });
        const models: Record<string, AiModelDefinition> = {};
        const registerModel = (name: string, model: LanguageModel) => {
          const price =
            typeof model === 'string'
              ? undefined
              : getModelPricing(model, alibabaBaseUrl);
          models[name] = {
            model,
            ...(price ? { pricing: { ...price.pricing } } : {}),
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
          onUsage: (event) => {
            const definition = event.model.name
              ? models[event.model.name]
              : undefined;
            const price = definition
              ? getModelPricing(event.model, alibabaBaseUrl)
              : undefined;
            const pricing = definition?.pricing;
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
              ...(price &&
              pricing &&
              event.cost !== undefined &&
              event.usage.inputTokens <= price.maxInputTokens
                ? {
                    estimatedCost: event.cost,
                    currency: price.currency,
                    pricingSnapshot: {
                      ...pricing,
                      condition: price.condition,
                      source: price.source,
                      verifiedAt: price.verifiedAt,
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
