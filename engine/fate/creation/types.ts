import { z } from 'zod';
import type { Quality, RealmType } from '@/types/constants';
import type { EffectConfig } from '@/engine/effect/types';

/**
 * AI 输出的命格蓝图 Schema
 * 注意：不包含任何具体数值，数值由程序生成
 */
export const FateBlueprintSchema = z.object({
  name: z.string().min(2).max(6).describe('命格名称，2-6字，古风有韵味'),
  description: z
    .string()
    .min(20)
    .max(120)
    .describe('命格描述，神秘古雅，富有宿命感'),
  affix_ids: z
    .array(z.string())
    .describe('选择的词条ID列表，必须符合品质和类型限制'),
});

export type FateBlueprint = z.infer<typeof FateBlueprintSchema>;

/**
 * 生成参数选项
 */
export interface FateGenerationOptions {
  count?: number;
  realm?: RealmType;
  guaranteedQualities?: Quality[]; // 指定生成的品质列表
}

/**
 * 最终生成的命格结构（兼容运行时）
 */
export interface GeneratedFate {
  name: string;
  quality: Quality;
  effects: EffectConfig[];
  description: string;
}
