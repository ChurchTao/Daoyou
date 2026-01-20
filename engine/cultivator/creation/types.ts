import { z } from 'zod';
import { ELEMENT_VALUES, GENDER_VALUES } from '@/types/constants';

// AI 只负责生成文本设定、灵根偏好和资质评分
export const CultivatorAISchema = z.object({
  name: z.string().min(2).max(4).describe('2-4字中文姓名'),
  gender: z.enum(GENDER_VALUES).describe('性别'),
  origin: z.string().min(2).max(40).describe('出身势力或地域'),
  personality: z.string().min(2).max(100).describe('性格概述'),
  background: z.string().min(10).max(300).describe('背景故事'),
  element_preferences: z
    .array(z.enum(ELEMENT_VALUES))
    .min(1)
    .max(4)
    .describe('该角色的灵根属性（如金、木、水、火、土）'),
  aptitude_score: z
    .number()
    .int()
    .gte(0)
    .lte(100)
    .describe('资质评分（0-100）'),
  balance_notes: z.string().max(200).describe('天道评分与设定说明'),
});

export type CultivatorAIData = z.infer<typeof CultivatorAISchema>;
