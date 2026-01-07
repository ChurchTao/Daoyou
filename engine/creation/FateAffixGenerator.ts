/**
 * 命格效果生成器
 *
 * 根据命格品质和方向标签从词条池中生成效果配置
 * 采用 AIGC 架构：AI 生成蓝图（名称/描述/方向标签），程序生成数值
 */

import type { EffectConfig } from '@/engine/effect/types';
import type { Quality, RealmType } from '@/types/constants';
import { QUALITY_VALUES } from '@/types/constants';
import { FATE_AFFIX_POOLS } from './affixes/fateAffixes';
import { EffectMaterializer } from './EffectMaterializer';
import type {
  AffixTag,
  AffixWeight,
  DirectionTag,
  MaterializationContext,
} from './types';

/**
 * 命格品质对应的效果数量
 */
const QUALITY_TO_EFFECT_COUNT: Record<Quality, number> = {
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
   * 根据命格类型、品质和方向标签生成效果
   *
   * @param fateType 命格类型（吉/凶）
   * @param quality 品质
   * @param realm 境界（用于数值缩放）
   * @param directionTags 方向标签
   * @returns 效果配置数组
   */
  static generate(
    fateType: '吉' | '凶',
    quality: Quality,
    realm: RealmType,
    directionTags: DirectionTag[] = [],
  ): EffectConfig[] {
    // 1. 根据命格类型选择词条池
    const pool =
      fateType === '吉'
        ? FATE_AFFIX_POOLS.auspicious
        : FATE_AFFIX_POOLS.inauspicious;

    // 2. 根据品质决定效果数量
    const effectCount = QUALITY_TO_EFFECT_COUNT[quality] ?? 1;

    // 3. 根据品质和方向标签筛选词条池
    const filteredPool = this.filterPool(pool, quality, directionTags);

    // 4. 权重随机选取
    const selectedAffixes = this.selectWeightedRandom(
      filteredPool,
      effectCount,
    );

    // 5. 数值化
    const context: MaterializationContext = {
      quality,
      realm,
    };

    return EffectMaterializer.materializeAll(selectedAffixes, context);
  }

  /**
   * 根据品质和方向标签筛选词条池
   */
  private static filterPool(
    pool: AffixWeight[],
    quality: Quality,
    directionTags: DirectionTag[],
  ): AffixWeight[] {
    const qualityIndex = QUALITY_VALUES.indexOf(quality);

    return pool.filter((affix) => {
      // 品质要求检查
      if (affix.minQuality) {
        const minIndex = QUALITY_VALUES.indexOf(affix.minQuality);
        if (qualityIndex < minIndex) return false;
      }
      if (affix.maxQuality) {
        const maxIndex = QUALITY_VALUES.indexOf(affix.maxQuality);
        if (qualityIndex > maxIndex) return false;
      }

      // 如果没有方向标签，返回所有满足品质要求的词条
      if (directionTags.length === 0) return true;

      // 如果词条有标签，检查是否有匹配
      if (affix.tags && affix.tags.length > 0) {
        // 将方向标签和词条标签进行匹配
        // 方向标签可能不直接等于词条标签，需要映射
        const affixTagSet = new Set(affix.tags);
        for (const tag of directionTags) {
          const mappedTag = this.mapDirectionToAffixTag(tag);
          if (mappedTag && affixTagSet.has(mappedTag)) {
            return true;
          }
        }
      }

      return true; // 没有标签的词条默认通过
    });
  }

  /**
   * 将方向标签映射到词条标签
   */
  private static mapDirectionToAffixTag(
    directionTag: DirectionTag,
  ): AffixTag | null {
    const mapping: Partial<Record<DirectionTag, AffixTag>> = {
      offensive: 'offensive',
      defensive: 'defensive',
      critical_boost: 'burst',
      lifesteal: 'lifesteal',
      sustain: 'sustain',
      burst: 'burst',
      healing_boost: 'healing_boost',
      mana_regen: 'mana_regen',
    };
    return mapping[directionTag] ?? null;
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
