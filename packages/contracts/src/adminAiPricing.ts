import { z } from 'zod';

/** Operational estimates per million tokens, not provider billing quotes. */
export const DEFAULT_AI_MODEL_PRICING = Object.freeze({
  currency: 'CNY',
  input: 1,
  output: 2,
});

const price = z.number().min(0).max(1_000_000);

export const AiModelPricingRuleSchema = z.strictObject({
  provider: z.string().trim().min(1).max(120),
  modelId: z.string().trim().min(1).max(240),
  currency: z.string().regex(/^[A-Z]{3}$/, '币种须为三位大写字母'),
  input: price,
  output: price,
  cachedInput: price.optional(),
});

export const AiPricingSettingsSchema = z
  .strictObject({
    models: z.array(AiModelPricingRuleSchema).max(200),
  })
  .superRefine(({ models }, context) => {
    const seen = new Set<string>();
    for (const [index, model] of models.entries()) {
      const key = JSON.stringify([model.provider, model.modelId]);
      if (seen.has(key)) {
        context.addIssue({
          code: 'custom',
          path: ['models', index, 'modelId'],
          message: '同一提供方和模型只能配置一条价格规则',
        });
      }
      seen.add(key);
    }
  });

export type AiModelPricingRule = z.infer<typeof AiModelPricingRuleSchema>;
export type AiPricingSettings = z.infer<typeof AiPricingSettingsSchema>;

export interface AdminAiPricingResponse {
  settings: AiPricingSettings;
  defaults: typeof DEFAULT_AI_MODEL_PRICING;
}
