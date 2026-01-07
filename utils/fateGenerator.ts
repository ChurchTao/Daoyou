/**
 * 命格蓝图 Schema 和生成器（AIGC 架构重构）
 *
 * 采用"AI蓝图 + 程序数值化"架构：
 * - AI 生成蓝图（名称、描述、方向标签）
 * - 程序控制品质分布和效果数值
 */

import { FateAffixGenerator } from '@/engine/creation/FateAffixGenerator';
import { type DirectionTag } from '@/engine/creation/types';
import { Quality, QUALITY_VALUES, type RealmType } from '@/types/constants';
import type { PreHeavenFate } from '@/types/cultivator';
import { z } from 'zod';
import { objectArray } from './aiClient';

// ============================================================
// AI 蓝图 Schema（不含具体数值）
// ============================================================

/**
 * 命格蓝图方向标签（AI 可选择的标签）
 */
const FATE_DIRECTION_TAGS = [
  // 属性方向
  'increase_vitality',
  'increase_spirit',
  'increase_wisdom',
  'increase_speed',
  'increase_willpower',
  // 战斗机制
  'offensive',
  'defensive',
  'critical_boost',
  'lifesteal',
  'sustain',
  'burst',
] as const;

/**
 * AI 输出的命格蓝图 Schema
 * 注意：不包含任何具体数值，数值由程序生成
 */
const FateBlueprintSchema = z.object({
  name: z.string().min(2).max(6).describe('命格名称，2-6字，古风有韵味'),
  type: z.enum(['吉', '凶']).describe('命格类型'),
  description: z
    .string()
    .min(20)
    .max(120)
    .describe('命格描述，神秘古雅，富有宿命感'),
  direction_tags: z
    .array(z.enum(FATE_DIRECTION_TAGS))
    .min(1)
    .max(3)
    .describe('效果方向标签，决定效果倾向'),
});

type FateBlueprint = z.infer<typeof FateBlueprintSchema>;

// ============================================================
// 品质分布配置
// ============================================================

/**
 * 每个品质出现的概率
 */
const QUALITY_CHANCE_MAP: Record<Quality, number> = {
  凡品: 0.3,
  灵品: 0.3,
  玄品: 0.2,
  真品: 0.1,
  地品: 0.04,
  天品: 0.03,
  仙品: 0.02,
  神品: 0.01,
};

/**
 * 随机生成指定数量的品质分布
 */
function getRandomQualityDistribution(count: number): Quality[] {
  const result: Quality[] = [];

  for (let i = 0; i < count; i++) {
    const random = Math.random();
    let accumulatedChance = 0;
    let selected: Quality = '凡品';

    for (const quality of QUALITY_VALUES) {
      const chance = QUALITY_CHANCE_MAP[quality];
      accumulatedChance += chance;
      if (random <= accumulatedChance) {
        selected = quality;
        break;
      }
    }

    result.push(selected);
  }

  return result;
}

// ============================================================
// AI 蓝图生成
// ============================================================

/**
 * 调用 AI 生成命格蓝图
 */
async function generateFateBlueprints(count: number): Promise<FateBlueprint[]> {
  const systemPrompt = `
# Role: 修仙界命格设计师 - 蓝图生成

你是一位精通东方玄幻修真体系的大能，负责设计「先天命格」蓝图。
**你只负责创意设计，具体数值效果由天道法则（程序）决定。**

## 重要约束

> ⚠️ **你的输出不包含任何具体数值！**
> 程序会根据品质自动生成所有效果数值。

## 输出格式（严格遵守）

只输出符合 JSON Schema 的纯 JSON 对象，不得包含任何额外文字。

### 枚举值限制
- **type**: 吉、凶
- **direction_tags**: ${FATE_DIRECTION_TAGS.join(', ')}

## 核心规则

### 1. 命格类型
- **吉相**：纯正面效果（如"九阳圣体"、"剑骨天成"）
- **凶相**：双刃剑效果，高风险高收益（如"天煞孤星"、"嗜血魔体"）

### 2. 方向标签选择（关键！）
根据命格名称和类型选择 1-3 个方向标签：
- 体质强健类（如"铜皮铁骨"） → increase_vitality, defensive
- 灵力天赋类（如"紫府圣胎"） → increase_spirit, offensive
- 悟性卓越类（如"天生道体"） → increase_wisdom
- 剑道天赋类（如"剑骨天成"） → critical_boost, burst
- 续航体质类（如"木灵体质"） → sustain, lifesteal
- 凶相攻击类（如"天煞孤星"） → offensive, burst

### 3. 命名与描述
- 名称：2-6字，古朴典雅，带有仙侠韵味
- 描述：20-120字，描述来源、表现或宿命感
- **不得描述具体数值效果**

## 禁止行为
- ❌ 不得输出任何数值（+15、增加10%等）
- ❌ 不得自定义枚举值
- ❌ 不得描述具体效果强度
`;

  const userPrompt = `
请设计 ${count} 个先天命格蓝图。

要求：
- 吉凶比例约 7:3
- 名称不重复，风格多样
- 每个命格都要有独特的方向标签组合

请直接输出符合 Schema 的 JSON。
`;

  try {
    const result = await objectArray(
      systemPrompt,
      userPrompt,
      {
        schema: FateBlueprintSchema,
        schemaName: '命格蓝图',
      },
      false,
    );
    return result.object;
  } catch (error) {
    console.error('[FateGenerator] AI 生成蓝图失败:', error);
    throw new Error('天道紊乱，本次凝聚失败，请重试');
  }
}

// ============================================================
// 蓝图数值化
// ============================================================

/**
 * 将 AI 蓝图转化为完整的命格对象
 */
function materializeFate(
  blueprint: FateBlueprint,
  quality: Quality,
  realm: RealmType = '炼气',
): PreHeavenFate {
  // 使用 FateAffixGenerator 生成效果
  const directionTags = blueprint.direction_tags.map(
    (tag) => tag as DirectionTag,
  );
  const effects = FateAffixGenerator.generate(
    blueprint.type,
    quality,
    realm,
    directionTags,
  );

  return {
    name: blueprint.name,
    quality,
    effects,
    description: blueprint.description,
  };
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 先天命格生成器（AIGC 架构）
 *
 * @param count 生成数量
 * @param realm 用于效果数值缩放的境界（默认炼气）
 * @returns 完整的命格对象数组
 */
export async function generatePreHeavenFates(
  count: number = 10,
  realm: RealmType = '炼气',
): Promise<PreHeavenFate[]> {
  // 1. 在代码中随机生成品质分布
  const qualities = getRandomQualityDistribution(count);
  const qualitySummary = qualities.reduce(
    (acc, q) => {
      acc[q] = (acc[q] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  console.log('[FateGenerator] 品质分布:', qualitySummary);

  // 2. 调用 AI 生成蓝图
  const blueprints = await generateFateBlueprints(count);
  console.log(`[FateGenerator] 获取到 ${blueprints.length} 个蓝图`);

  // 3. 将蓝图数值化为完整命格
  const fates = blueprints.map((blueprint, index) => {
    const quality = qualities[index] || '凡品';
    return materializeFate(blueprint, quality, realm);
  });

  return fates;
}

/**
 * 直接从蓝图生成命格（用于测试或自定义场景）
 */
export function materializeFateFromBlueprint(
  name: string,
  type: '吉' | '凶',
  quality: Quality,
  directionTags: DirectionTag[],
  description: string,
  realm: RealmType = '炼气',
): PreHeavenFate {
  const effects = FateAffixGenerator.generate(
    type,
    quality,
    realm,
    directionTags,
  );

  return {
    name,
    quality,
    effects,
    description,
  };
}
