import { ELEMENT_VALUES, GENDER_VALUES } from '@shared/types/constants';
import { z } from 'zod';

const MAX_ELEMENT_PREFERENCES = 4;

const elementPreferenceSchema = z
  .array(z.enum(ELEMENT_VALUES))
  .min(1)
  .max(MAX_ELEMENT_PREFERENCES)
  .describe('该角色的灵根属性（如金、木、水、火、土）');

// AI 只负责生成文本设定、灵根偏好和资质评分
export const CultivatorAISchema = z.object({
  player_race: z.literal('human').default('human').describe('玩家种族，首版固定为人族'),
  race_narrative: z.string().min(4).max(120).default('人身近道，百法皆可参悟。').describe('种族判词'),
  name: z.string().min(2).max(4).describe('2-4字中文姓名'),
  gender: z.enum(GENDER_VALUES).describe('性别'),
  origin: z.string().min(2).max(40).describe('出身势力或地域'),
  personality: z.string().min(2).max(100).describe('性格概述'),
  background: z.string().min(10).max(300).describe('背景故事'),
  element_preferences: elementPreferenceSchema,
  aptitude_score: z
    .number()
    .int()
    .gte(0)
    .lte(100)
    .describe('资质评分（0-100）'),
  balance_notes: z.string().max(200).describe('天道评分与设定说明'),
});

export const CultivatorAIRawSchema = CultivatorAISchema.extend({
  element_preferences: z
    .array(z.enum(ELEMENT_VALUES))
    .min(1)
    .max(ELEMENT_VALUES.length)
    .describe('该角色的灵根属性原始输出，后续会去重并裁剪为最多4项'),
});

export type CultivatorAIData = z.infer<typeof CultivatorAISchema>;
export type CultivatorAIRawData = z.infer<typeof CultivatorAIRawSchema>;

export function normalizeCultivatorAIData(
  data: CultivatorAIRawData,
): CultivatorAIData {
  return CultivatorAISchema.parse({
    ...data,
    player_race: 'human',
    element_preferences: Array.from(new Set(data.element_preferences)).slice(
      0,
      MAX_ELEMENT_PREFERENCES,
    ),
  });
}
