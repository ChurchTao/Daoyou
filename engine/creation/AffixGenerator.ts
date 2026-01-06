/**
 * 词条生成器
 *
 * 根据物品类型、品质、境界等条件从词条池中选取适当的词条
 * 然后通过 EffectMaterializer 将词条数值化为 EffectConfig[]
 */

import type { EffectConfig } from '@/engine/effect/types';
import type {
  ElementType,
  EquipmentSlot,
  Quality,
  RealmType,
  SkillGrade,
  SkillType,
} from '@/types/constants';
import { QUALITY_VALUES } from '@/types/constants';
import {
  ARTIFACT_AFFIX_POOL,
  CONSUMABLE_AFFIX_POOL,
  getSkillAffixPool,
} from './affixes';
import { QUALITY_MAX_EFFECTS } from './creationConfig';
import { EffectMaterializer } from './EffectMaterializer';
import type {
  AffixGenerationResult,
  AffixWeight,
  DirectionTag,
  MaterializationContext,
} from './types';

// ============================================================
// 词条生成器
// ============================================================

export class AffixGenerator {
  /**
   * 为法宝生成词条
   */
  static generateArtifactAffixes(
    slot: EquipmentSlot,
    quality: Quality,
    realm: RealmType,
    element?: ElementType,
    directionTags?: DirectionTag[],
  ): AffixGenerationResult {
    const context: MaterializationContext = {
      realm,
      quality,
      element,
    };

    const selectedAffixes: AffixWeight[] = [];
    const affixInfo: AffixGenerationResult['selectedAffixes'] = [];

    // 1. 选择主词条（1-2个，根据品质）
    const primaryCount = this.getPrimaryAffixCount(quality);
    const primaryPool = this.filterAffixes(
      ARTIFACT_AFFIX_POOL.primary,
      slot,
      quality,
      directionTags,
    );

    const primarySelected = this.selectWeightedRandom(
      primaryPool,
      primaryCount,
    );
    selectedAffixes.push(...primarySelected);

    // 2. 选择副词条（0-3个，根据品质和境界）
    const secondaryCount = this.getSecondaryAffixCount(quality, realm);
    if (secondaryCount > 0) {
      const secondaryPool = this.filterAffixes(
        ARTIFACT_AFFIX_POOL.secondary,
        slot,
        quality,
      );

      const secondarySelected = this.selectWeightedRandom(
        secondaryPool,
        secondaryCount,
      );
      selectedAffixes.push(...secondarySelected);
    }

    // 3. 收集选中的词条信息
    for (const affix of selectedAffixes) {
      affixInfo.push({
        displayName: affix.displayName,
        effectType: affix.effectType,
        tags: affix.tags ?? [],
      });
    }

    // 4. 数值化
    const effects = EffectMaterializer.materializeAll(selectedAffixes, context);

    return {
      effects,
      selectedAffixes: affixInfo,
    };
  }

  /**
   * 为丹药生成词条
   */
  static generateConsumableAffixes(
    quality: Quality,
    realm: RealmType,
    directionTags: DirectionTag[],
  ): AffixGenerationResult {
    const context: MaterializationContext = {
      realm,
      quality,
    };

    const selectedAffixes: AffixWeight[] = [];
    const affixInfo: AffixGenerationResult['selectedAffixes'] = [];

    // 1. 选择主词条（1个，根据方向标签）
    const primaryPool = this.filterConsumableAffixes(
      CONSUMABLE_AFFIX_POOL.primary,
      quality,
      directionTags,
    );

    const primarySelected = this.selectWeightedRandom(primaryPool, 1);
    selectedAffixes.push(...primarySelected);

    // 2. 高品质丹药可能有副词条
    if (this.qualityIndex(quality) >= this.qualityIndex('真品')) {
      const secondaryPool = this.filterConsumableAffixes(
        CONSUMABLE_AFFIX_POOL.secondary,
        quality,
      );

      if (secondaryPool.length > 0 && Math.random() < 0.3) {
        const secondarySelected = this.selectWeightedRandom(secondaryPool, 1);
        selectedAffixes.push(...secondarySelected);
      }
    }

    // 3. 收集选中的词条信息
    for (const affix of selectedAffixes) {
      affixInfo.push({
        displayName: affix.displayName,
        effectType: affix.effectType,
        tags: affix.tags ?? [],
      });
    }

    // 4. 数值化
    const effects = EffectMaterializer.materializeAll(selectedAffixes, context);

    return {
      effects,
      selectedAffixes: affixInfo,
    };
  }

  /**
   * 为神通生成词条
   */
  static generateSkillAffixes(
    skillType: SkillType,
    element: ElementType,
    grade: SkillGrade,
    wisdom: number = 100,
  ): AffixGenerationResult {
    // 从技能品阶推断品质
    const quality = this.gradeToQuality(grade);

    const context: MaterializationContext = {
      realm: '筑基', // 技能不依赖境界，使用基准值
      quality,
      element,
      wisdom,
      skillGrade: grade,
    };

    const selectedAffixes: AffixWeight[] = [];
    const affixInfo: AffixGenerationResult['selectedAffixes'] = [];

    // 获取技能类型对应的词条池
    const pool = getSkillAffixPool(skillType);

    // 1. 选择主词条（1个）
    const primaryPool = this.filterSkillAffixes(pool.primary, quality);
    const primarySelected = this.selectWeightedRandom(primaryPool, 1);
    selectedAffixes.push(...primarySelected);

    // 2. 高品阶技能可能有副词条
    if (
      pool.secondary.length > 0 &&
      this.qualityIndex(quality) >= this.qualityIndex('真品')
    ) {
      const secondaryPool = this.filterSkillAffixes(pool.secondary, quality);
      if (secondaryPool.length > 0 && Math.random() < 0.4) {
        const secondarySelected = this.selectWeightedRandom(secondaryPool, 1);
        selectedAffixes.push(...secondarySelected);
      }
    }

    // 3. 收集选中的词条信息
    for (const affix of selectedAffixes) {
      affixInfo.push({
        displayName: affix.displayName,
        effectType: affix.effectType,
        tags: affix.tags ?? [],
      });
    }

    // 4. 数值化
    const effects = EffectMaterializer.materializeAll(selectedAffixes, context);

    return {
      effects,
      selectedAffixes: affixInfo,
    };
  }

  /**
   * 为法宝添加诅咒词条（五行相克时调用）
   */
  static generateCurseAffix(
    realm: RealmType,
    quality: Quality,
  ): EffectConfig[] {
    const context: MaterializationContext = { realm, quality };

    const cursePool = ARTIFACT_AFFIX_POOL.curse ?? [];
    if (cursePool.length === 0) return [];

    const selected = this.selectWeightedRandom(cursePool, 1);
    return EffectMaterializer.materializeAll(selected, context);
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 根据品质获取主词条数量
   */
  private static getPrimaryAffixCount(quality: Quality): number {
    const index = this.qualityIndex(quality);
    if (index <= 1) return 1; // 凡品、灵品
    if (index <= 3) return 1; // 玄品、真品
    return 2; // 地品及以上
  }

  /**
   * 根据品质和境界获取副词条数量
   */
  private static getSecondaryAffixCount(
    quality: Quality,
    realm: RealmType,
  ): number {
    const maxByQuality = QUALITY_MAX_EFFECTS[quality] ?? 0;

    // 境界限制
    const realmLimits: Record<RealmType, number> = {
      炼气: 0,
      筑基: 1,
      金丹: 2,
      元婴: 2,
      化神: 3,
      炼虚: 3,
      合体: 4,
      大乘: 4,
      渡劫: 5,
    };
    const maxByRealm = realmLimits[realm] ?? 0;

    return Math.min(maxByQuality, maxByRealm);
  }

  /**
   * 过滤法宝词条池
   */
  private static filterAffixes(
    pool: AffixWeight[],
    slot: EquipmentSlot,
    quality: Quality,
    _directionTags?: DirectionTag[],
  ): AffixWeight[] {
    const qualityIdx = this.qualityIndex(quality);

    return pool.filter((affix) => {
      // 槽位匹配
      if (affix.slots && !affix.slots.includes(slot)) {
        return false;
      }

      // 品质范围检查
      if (affix.minQuality) {
        const minIdx = this.qualityIndex(affix.minQuality);
        if (qualityIdx < minIdx) return false;
      }
      if (affix.maxQuality) {
        const maxIdx = this.qualityIndex(affix.maxQuality);
        if (qualityIdx > maxIdx) return false;
      }

      // 方向标签偏好（可选，增加权重但不排除）
      // 这里只做筛选，权重调整在 selectWeightedRandom 中处理

      return true;
    });
  }

  /**
   * 过滤丹药词条池
   */
  private static filterConsumableAffixes(
    pool: AffixWeight[],
    quality: Quality,
    _directionTags?: DirectionTag[],
  ): AffixWeight[] {
    const qualityIdx = this.qualityIndex(quality);

    return pool.filter((affix) => {
      // 品质范围检查
      if (affix.minQuality) {
        const minIdx = this.qualityIndex(affix.minQuality);
        if (qualityIdx < minIdx) return false;
      }
      if (affix.maxQuality) {
        const maxIdx = this.qualityIndex(affix.maxQuality);
        if (qualityIdx > maxIdx) return false;
      }

      return true;
    });
  }

  /**
   * 过滤技能词条池
   */
  private static filterSkillAffixes(
    pool: AffixWeight[],
    quality: Quality,
  ): AffixWeight[] {
    const qualityIdx = this.qualityIndex(quality);

    return pool.filter((affix) => {
      if (affix.minQuality) {
        const minIdx = this.qualityIndex(affix.minQuality);
        if (qualityIdx < minIdx) return false;
      }
      if (affix.maxQuality) {
        const maxIdx = this.qualityIndex(affix.maxQuality);
        if (qualityIdx > maxIdx) return false;
      }
      return true;
    });
  }

  /**
   * 权重随机选取
   */
  private static selectWeightedRandom(
    pool: AffixWeight[],
    count: number,
  ): AffixWeight[] {
    if (pool.length === 0) return [];
    if (pool.length <= count) return [...pool];

    const selected: AffixWeight[] = [];
    const remaining = [...pool];

    for (let i = 0; i < count && remaining.length > 0; i++) {
      const totalWeight = remaining.reduce((sum, a) => sum + a.weight, 0);
      let random = Math.random() * totalWeight;

      for (let j = 0; j < remaining.length; j++) {
        random -= remaining[j].weight;
        if (random <= 0) {
          selected.push(remaining[j]);
          remaining.splice(j, 1);
          break;
        }
      }
    }

    return selected;
  }

  /**
   * 品质索引
   */
  private static qualityIndex(quality: Quality): number {
    return QUALITY_VALUES.indexOf(quality);
  }

  /**
   * 技能品阶转品质（用于词条筛选）
   */
  private static gradeToQuality(grade: SkillGrade): Quality {
    if (grade.startsWith('黄阶')) return '灵品';
    if (grade.startsWith('玄阶')) return '玄品';
    if (grade.startsWith('地阶')) return '真品';
    if (grade.startsWith('天阶')) return '地品';
    return '玄品';
  }
}
