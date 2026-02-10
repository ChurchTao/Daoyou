import {
  ELEMENT_VALUES,
  type ElementType,
  type MaterialType,
  type Quality,
} from '@/types/constants';
import { z } from 'zod';

// AI 生成的部分：包含名称、描述、以及 AI 决定的元素
export const MaterialAISchema = z.object({
  name: z.string().min(2).max(10).describe('材料名称'),
  description: z.string().min(10).max(100).describe('材料描述'),
  element: z
    .enum(ELEMENT_VALUES)
    .describe('材料的五行属性（金/木/水/火/土/风/雷/冰）'),
});

export type MaterialAIData = z.infer<typeof MaterialAISchema>;

// 程序生成的骨架部分
export interface MaterialSkeleton {
  type: MaterialType;
  rank: Quality;
  quantity: number;
  // 可选：如果指定了元素，AI 必须遵循；如果未指定，AI 自由发挥
  forcedElement?: ElementType;
}

// 最终组合的完整材料
export interface GeneratedMaterial {
  name: string;
  type: MaterialType;
  rank: Quality;
  element: ElementType;
  description: string;
  quantity: number;
  price: number;
}

// 随机生成参数选项
export interface MaterialRandomOptions {
  guaranteedRank?: Quality; // 指定保底品质（可选）
  specifiedType?: MaterialType; // 指定类型（可选）
  specifiedElement?: ElementType; // 指定元素（可选）
}
