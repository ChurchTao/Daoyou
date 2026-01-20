/**
 * 命格蓝图 Schema 和生成器（AIGC 架构重构）
 *
 * 采用"AI蓝图 + 程序数值化"架构：
 * - AI 根据品质选择合适的词条ID
 * - 程序验证并生成数值
 */

import { buildAffixTable } from '@/engine/creation/AffixUtils';
import { FATE_AFFIXES } from '@/engine/creation/affixes/fateAffixes';
import {
  FateAffixGenerator,
  QUALITY_TO_EFFECT_COUNT,
} from '@/engine/creation/FateAffixGenerator';
import { Quality, QUALITY_VALUES, type RealmType } from '@/types/constants';
import type { PreHeavenFate } from '@/types/cultivator';
import { z } from 'zod';
import { objectArray } from './aiClient';

// ============================================================
// AI 蓝图 Schema（不含具体数值）
// ============================================================

/**
 * AI 输出的命格蓝图 Schema
 * 注意：不包含任何具体数值，数值由程序生成
 */
const FateBlueprintSchema = z.object({
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
 * @param qualities 为每个生成的命格预分配的品质
 */
async function generateFateBlueprints(
  qualities: Quality[],
): Promise<FateBlueprint[]> {
  const count = qualities.length;
  const affixTable = buildAffixTable(FATE_AFFIXES, {
    showSlots: false,
    showQuality: true,
  });

  const qualityRules = Object.entries(QUALITY_TO_EFFECT_COUNT)
    .map(([q, c]) => `- ${q}: 选择 ${c} 个词条`)
    .join('\n');

  const systemPrompt = `
# Role: 修仙界命格设计师 - 蓝图生成

你是一位精通东方玄幻修真体系的大能，负责设计「先天命格」蓝图。

## 任务目标
根据输入的品质列表，为每一个命格生成蓝图。
你需要从提供的词条库中选择合适的词条ID（affix_ids）。

## 核心规则

### 1. 词条选择
- **品质限制**：选择的词条要求的最低品质（minQuality）不能高于命格当前的品质。
  - 例如：【地品】命格可以选择【凡品】、【灵品】、【玄品】、【真品】、【地品】要求的词条。
  - 但不能选择【天品】要求的词条。

### 2. 词条数量规则
根据命格品质，必须选择指定数量的词条：
${qualityRules}

## 词条库
${affixTable}

## 输出要求
- 只输出符合 JSON Schema 的纯 JSON 对象
- **affix_ids** 必须是词条库中真实存在的 ID
- 严格遵守品质和数量限制
`;

  const userPrompt = `
请生成 ${count} 个先天命格蓝图。
预分配的品质如下：
${qualities.map((q, i) => `${i + 1}. ${q}`).join('\n')}

请严格按顺序生成，确保每个命格的词条选择符合其品质限制。
`;

  try {
    const result = await objectArray(
      systemPrompt,
      userPrompt,
      {
        schema: FateBlueprintSchema,
        schemaName: '命格蓝图列表',
      },
      false, // 不强制 json 模式，使用 function calling 模式可能更准，或者 keep false
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
  try {
    const effects = FateAffixGenerator.generate(
      quality,
      realm,
      blueprint.affix_ids,
    );

    return {
      name: blueprint.name,
      quality,
      effects,
      description: blueprint.description,
    };
  } catch (error) {
    console.warn(
      `[FateGenerator] 命格 ${blueprint.name} 生成失败，尝试降级处理:`,
      error,
    );
    // 降级处理：生成随机词条
    const fallbackEffects = FateAffixGenerator.generateRandom(
      quality,
      realm,
    );
    return {
      name: blueprint.name,
      quality,
      effects: fallbackEffects,
      description: blueprint.description + ' (天道修正)',
    };
  }
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

  // 2. 调用 AI 生成蓝图 (传入品质列表)
  const blueprints = await generateFateBlueprints(qualities);
  console.log(`[FateGenerator] 获取到 ${blueprints.length} 个蓝图`);

  // 3. 将蓝图数值化为完整命格
  // 注意：需要确保 blueprints 和 qualities 一一对应
  // 如果 AI 返回数量不对，这里可能会错位，但 objectArray 通常会尽量满足数量
  const fates: PreHeavenFate[] = [];

  for (let i = 0; i < qualities.length; i++) {
    const quality = qualities[i];
    const blueprint = blueprints[i];

    if (!blueprint) {
      console.warn(`[FateGenerator] 缺少第 ${i + 1} 个蓝图，跳过`);
      continue;
    }

    fates.push(materializeFate(blueprint, quality, realm));
  }

  return fates;
}

/**
 * 直接从蓝图生成命格（用于测试或自定义场景）
 */
export function materializeFateFromBlueprint(
  name: string,
  quality: Quality,
  affixIds: string[],
  description: string,
  realm: RealmType = '炼气',
): PreHeavenFate {
  const effects = FateAffixGenerator.generate(quality, realm, affixIds);

  return {
    name,
    quality,
    effects,
    description,
  };
}
