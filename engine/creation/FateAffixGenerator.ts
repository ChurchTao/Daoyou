/**
 * 命格效果生成器
 *
 * 基于新的词条ID直接选择架构：
 * - AI 直接从词条池中选择词条ID
 * - 程序验证选择并生成数值
 */

import type { EffectConfig } from '@/engine/effect/types';
import type { Quality, RealmType } from '@/types/constants';
import { FATE_AFFIXES } from './affixes/fateAffixes';
import {
  buildAffixTable,
  filterAffixPool,
  materializeAffixesById,
  validateFateAffixSelection,
} from './AffixUtils';
import type { AffixWeight, MaterializationContext } from './types';

/**
 * 命格品质对应的效果数量
 */
export const QUALITY_TO_EFFECT_COUNT: Record<Quality, number> = {
  凡品: 1,
  灵品: 1,
  玄品: 2,
  真品: 2,
  地品: 2,
  天品: 3,
  仙品: 3,
  神品: 3,
};

/**
 * 命格效果生成器
 */
export class FateAffixGenerator {
  /**
   * 根据品质获取可用词条池
   */
  static getAffixPool(quality: Quality): AffixWeight[] {
    return filterAffixPool(FATE_AFFIXES, quality);
  }

  /**
   * 获取指定品质的效果数量上限
   */
  static getEffectCount(quality: Quality): number {
    return QUALITY_TO_EFFECT_COUNT[quality] ?? 1;
  }

  /**
   * 构建词条选择提示词
   */
  static buildSelectionPrompt(quality: Quality): string {
    const pool = this.getAffixPool(quality);
    const effectCount = this.getEffectCount(quality);

    const parts: string[] = [
      `## 命格词条 (选择1-${effectCount}个)\n`,
      buildAffixTable(pool, { showSlots: false, showQuality: true }),
    ];

    return parts.join('\n');
  }

  /**
   * 根据AI选择的词条ID生成效果
   *
   * @param quality 品质
   * @param realm 境界（用于数值缩放）
   * @param selectedAffixIds AI选择的词条ID数组
   * @returns 效果配置数组
   * @throws 如果词条选择无效
   */
  static generate(
    quality: Quality,
    realm: RealmType,
    selectedAffixIds: string[],
  ): EffectConfig[] {
    // 1. 获取词条池
    const pool = FATE_AFFIXES;

    // 2. 获取期望的效果数量
    const expectedCount = this.getEffectCount(quality);

    // 3. 验证选择
    const validation = validateFateAffixSelection(
      selectedAffixIds,
      pool,
      quality,
      expectedCount,
    );

    if (!validation.valid) {
      throw new Error(`命格词条选择无效: ${validation.errors.join('; ')}`);
    }

    // 4. 构建物化上下文
    const context: MaterializationContext = {
      quality,
      realm,
    };

    // 5. 物化词条为效果配置
    return materializeAffixesById(selectedAffixIds, pool, context);
  }

  /**
   * 生成随机命格效果（用于NPC或测试）
   * 保留原有的权重随机选取逻辑
   */
  static generateRandom(
    quality: Quality,
    realm: RealmType,
  ): EffectConfig[] {
    const pool = this.getAffixPool(quality);
    const effectCount = this.getEffectCount(quality);

    // 权重随机选取
    const selectedAffixes = this.selectWeightedRandom(pool, effectCount);
    const selectedIds = selectedAffixes.map((a) => a.id);

    return this.generate(quality, realm, selectedIds);
  }

  /**
   * 权重随机选取（不重复）
   */
  private static selectWeightedRandom(
    pool: AffixWeight[],
    count: number,
  ): AffixWeight[] {
    if (pool.length === 0) return [];
    if (pool.length <= count) return [...pool];

    const result: AffixWeight[] = [];
    const remaining = [...pool];

    for (let i = 0; i < count && remaining.length > 0; i++) {
      // 计算总权重
      const totalWeight = remaining.reduce((sum, a) => sum + a.weight, 0);

      // 随机选择
      let random = Math.random() * totalWeight;
      let selectedIndex = 0;

      for (let j = 0; j < remaining.length; j++) {
        random -= remaining[j].weight;
        if (random <= 0) {
          selectedIndex = j;
          break;
        }
      }

      // 添加到结果并从池中移除
      result.push(remaining[selectedIndex]);
      remaining.splice(selectedIndex, 1);
    }

    return result;
  }
}
