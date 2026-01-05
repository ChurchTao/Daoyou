/**
 * 副本奖励系统 - 奖励工厂
 *
 * 将 AI 生成的奖励蓝图转化为实际的 ResourceOperation，
 * 根据地图境界门槛和评级生成具体数值。
 */

import { EffectType } from '@/engine/effect';
import type { ResourceOperation } from '@/engine/resource/types';
import type {
  ElementType,
  EquipmentSlot,
  Quality,
  RealmType,
} from '@/types/constants';
import { QUALITY_VALUES, REALM_VALUES } from '@/types/constants';
import type {
  Artifact,
  ArtifactBonus,
  Consumable,
  Material,
} from '@/types/cultivator';
import {
  QUALITY_HINT_OFFSET,
  REALM_REWARD_CONFIG,
  TIER_MULTIPLIER,
} from './rewardConfig';
import type {
  DirectionTag,
  QualityHint,
  RewardBlueprint,
  RewardRangeConfig,
  ValueRange,
} from './types';

/**
 * 奖励工厂 - 将 AI 蓝图转化为实际物品
 */
export class RewardFactory {
  /**
   * 将 AI 蓝图数组转化为实际的 ResourceOperation 数组
   */
  static materialize(
    blueprints: RewardBlueprint[],
    mapRealm: RealmType,
    tier: string,
  ): ResourceOperation[] {
    return blueprints.map((bp) => this.materializeOne(bp, mapRealm, tier));
  }

  /**
   * 将单个 AI 蓝图转化为 ResourceOperation
   */
  private static materializeOne(
    blueprint: RewardBlueprint,
    mapRealm: RealmType,
    tier: string,
  ): ResourceOperation {
    const config = REALM_REWARD_CONFIG[mapRealm] || REALM_REWARD_CONFIG['筑基'];
    const multiplier = TIER_MULTIPLIER[tier] || TIER_MULTIPLIER['C'];

    switch (blueprint.type) {
      case 'spirit_stones':
        return this.createSpiritStones(blueprint, config, multiplier);

      case 'material':
        return this.createMaterial(blueprint, config, multiplier, mapRealm);

      case 'artifact':
        return this.createArtifact(blueprint, config, multiplier, mapRealm);

      case 'consumable':
        return this.createConsumable(blueprint, config, multiplier, mapRealm);

      case 'cultivation_exp':
        return this.createCultivationExp(blueprint, config, multiplier);

      case 'comprehension_insight':
        return this.createComprehensionInsight(blueprint, config, multiplier);

      default:
        // Fallback: 返回灵石
        console.warn(
          `[RewardFactory] 未知的奖励类型: ${blueprint.type}, 使用灵石作为后备`,
        );
        return {
          type: 'spirit_stones',
          value: this.randomInRange(config.spirit_stones, multiplier),
        };
    }
  }

  // ============ 具体奖励创建方法 ============

  /**
   * 创建灵石奖励
   */
  private static createSpiritStones(
    bp: RewardBlueprint,
    config: RewardRangeConfig,
    multiplier: ValueRange,
  ): ResourceOperation {
    const value = this.randomInRange(config.spirit_stones, multiplier);
    return {
      type: 'spirit_stones',
      value,
    };
  }

  /**
   * 创建材料奖励
   */
  private static createMaterial(
    bp: RewardBlueprint,
    config: RewardRangeConfig,
    multiplier: ValueRange,
    mapRealm: RealmType,
  ): ResourceOperation {
    const element = this.extractElement(bp.direction_tags);
    const quality = this.mapQuality(bp.quality_hint, mapRealm);
    const price = this.randomInRange(config.material_price, multiplier);

    const material: Material = {
      name: bp.name,
      type: this.inferMaterialType(bp.description),
      rank: quality,
      element,
      description: bp.description,
      price,
      quantity: 1,
    };

    return {
      type: 'material',
      value: 1,
      name: bp.name,
      data: material,
    };
  }

  /**
   * 创建法宝奖励
   */
  private static createArtifact(
    bp: RewardBlueprint,
    config: RewardRangeConfig,
    multiplier: ValueRange,
    mapRealm: RealmType,
  ): ResourceOperation {
    const element = this.extractElement(bp.direction_tags);
    const quality = this.mapQuality(bp.quality_hint, mapRealm);
    const bonusValue = this.randomInRange(config.artifact_bonus, multiplier);

    // 根据方向性标签分配属性加成
    const bonus = this.distributeBonus(bp.direction_tags, bonusValue);

    // 将 bonus 转换为 effects 数组
    const effects: {
      type: EffectType;
      trigger?: string;
      params?: Record<string, unknown>;
    }[] = [];
    for (const [attr, value] of Object.entries(bonus)) {
      if (value && value > 0) {
        effects.push({
          type: EffectType.StatModifier,
          trigger: 'ON_STAT_CALC',
          params: { attribute: attr, value, modType: 1 },
        });
      }
    }

    const artifact: Artifact = {
      name: bp.name,
      slot: this.inferSlot(bp.direction_tags),
      element,
      quality,
      required_realm: mapRealm,
      description: bp.description,
      effects,
    };

    return {
      type: 'artifact',
      value: 1,
      name: bp.name,
      data: artifact,
    };
  }

  /**
   * 创建消耗品（丹药）奖励
   */
  private static createConsumable(
    bp: RewardBlueprint,
    config: RewardRangeConfig,
    multiplier: ValueRange,
    mapRealm: RealmType,
  ): ResourceOperation {
    const quality = this.mapQuality(bp.quality_hint, mapRealm);
    const effectValue = this.randomInRange(
      config.consumable_effect,
      multiplier,
    );

    // 根据方向性标签确定效果类型
    const effectType = this.inferConsumableEffectType(bp.direction_tags);

    const consumable: Consumable = {
      name: bp.name,
      type: '丹药',
      quality,
      effect: [
        {
          effect_type: effectType,
          bonus: effectValue,
        },
      ],
      quantity: 1,
      description: bp.description,
    };

    return {
      type: 'consumable',
      value: 1,
      name: bp.name,
      data: consumable,
    };
  }

  /**
   * 创建修为奖励
   */
  private static createCultivationExp(
    bp: RewardBlueprint,
    config: RewardRangeConfig,
    multiplier: ValueRange,
  ): ResourceOperation {
    const value = this.randomInRange(config.cultivation_exp, multiplier);
    return {
      type: 'cultivation_exp',
      value,
    };
  }

  /**
   * 创建感悟值奖励
   */
  private static createComprehensionInsight(
    bp: RewardBlueprint,
    config: RewardRangeConfig,
    multiplier: ValueRange,
  ): ResourceOperation {
    const value = this.randomInRange(config.comprehension_insight, multiplier);
    return {
      type: 'comprehension_insight',
      value,
    };
  }

  // ============ 辅助方法 ============

  /**
   * 在范围内根据倍率随机取值
   */
  private static randomInRange(
    range: ValueRange,
    multiplier: ValueRange,
  ): number {
    const span = range.max - range.min;
    const effectiveMin = range.min + span * multiplier.min;
    const effectiveMax = range.min + span * multiplier.max;
    return Math.floor(
      effectiveMin + Math.random() * (effectiveMax - effectiveMin),
    );
  }

  /**
   * 从方向标签提取元素类型
   */
  private static extractElement(tags: DirectionTag[]): ElementType {
    const elementMap: Partial<Record<DirectionTag, ElementType>> = {
      fire_affinity: '火',
      water_affinity: '水',
      wood_affinity: '木',
      metal_affinity: '金',
      earth_affinity: '土',
      thunder_affinity: '雷',
      ice_affinity: '冰',
      wind_affinity: '风',
    };
    for (const tag of tags) {
      if (elementMap[tag]) return elementMap[tag]!;
    }
    // 默认随机返回一个元素
    const elements: ElementType[] = ['金', '木', '水', '火', '土'];
    return elements[Math.floor(Math.random() * elements.length)];
  }

  /**
   * 根据方向标签分配属性加成
   */
  private static distributeBonus(
    tags: DirectionTag[],
    totalValue: number,
  ): ArtifactBonus {
    const attributeMap: Partial<Record<DirectionTag, keyof ArtifactBonus>> = {
      increase_vitality: 'vitality',
      increase_spirit: 'spirit',
      increase_wisdom: 'wisdom',
      increase_speed: 'speed',
      increase_willpower: 'willpower',
      defense_boost: 'vitality',
      critical_boost: 'wisdom',
    };

    const bonus: ArtifactBonus = {};
    const relevantTags = tags.filter((t) => attributeMap[t]);

    if (relevantTags.length === 0) {
      // 无明确指向，随机分配到一个属性
      const attrs: (keyof ArtifactBonus)[] = [
        'vitality',
        'spirit',
        'wisdom',
        'speed',
        'willpower',
      ];
      const randomAttr = attrs[Math.floor(Math.random() * attrs.length)];
      bonus[randomAttr] = totalValue;
    } else {
      // 按标签数量均分
      const perTag = Math.max(1, Math.floor(totalValue / relevantTags.length));
      for (const tag of relevantTags) {
        const attr = attributeMap[tag]!;
        bonus[attr] = (bonus[attr] || 0) + perTag;
      }
    }
    return bonus;
  }

  /**
   * 映射品质
   */
  private static mapQuality(hint: QualityHint, realm: RealmType): Quality {
    const realmIndex = REALM_VALUES.indexOf(realm);
    // 基础品质：炼气=凡品, 筑基=灵品, 金丹=玄品, ...
    const baseIndex = Math.min(realmIndex, QUALITY_VALUES.length - 1);
    const offset = QUALITY_HINT_OFFSET[hint] || 0;
    const finalIndex = Math.max(
      0,
      Math.min(baseIndex + offset, QUALITY_VALUES.length - 1),
    );
    return QUALITY_VALUES[finalIndex];
  }

  /**
   * 推断装备槽位
   */
  private static inferSlot(tags: DirectionTag[]): EquipmentSlot {
    // 根据标签推断合适的槽位
    if (tags.includes('increase_vitality') || tags.includes('defense_boost')) {
      return 'armor';
    }
    if (
      tags.includes('increase_spirit') ||
      tags.includes('increase_wisdom') ||
      tags.includes('critical_boost')
    ) {
      return 'weapon';
    }
    // 默认为饰品
    return 'accessory';
  }

  /**
   * 推断材料类型
   */
  private static inferMaterialType(
    description: string,
  ): 'herb' | 'ore' | 'monster' | 'tcdb' | 'aux' {
    const lowerDesc = description.toLowerCase();
    if (
      lowerDesc.includes('草') ||
      lowerDesc.includes('花') ||
      lowerDesc.includes('藤') ||
      lowerDesc.includes('叶') ||
      lowerDesc.includes('根')
    ) {
      return 'herb';
    }
    if (
      lowerDesc.includes('石') ||
      lowerDesc.includes('矿') ||
      lowerDesc.includes('晶') ||
      lowerDesc.includes('铁') ||
      lowerDesc.includes('玉')
    ) {
      return 'ore';
    }
    if (
      lowerDesc.includes('兽') ||
      lowerDesc.includes('妖') ||
      lowerDesc.includes('血') ||
      lowerDesc.includes('骨') ||
      lowerDesc.includes('皮')
    ) {
      return 'monster';
    }
    // 默认为辅助材料
    return 'aux';
  }

  /**
   * 推断消耗品效果类型
   */
  private static inferConsumableEffectType(
    tags: DirectionTag[],
  ):
    | '永久提升体魄'
    | '永久提升灵力'
    | '永久提升悟性'
    | '永久提升身法'
    | '永久提升神识' {
    const effectMap: Partial<
      Record<
        DirectionTag,
        | '永久提升体魄'
        | '永久提升灵力'
        | '永久提升悟性'
        | '永久提升身法'
        | '永久提升神识'
      >
    > = {
      increase_vitality: '永久提升体魄',
      increase_spirit: '永久提升灵力',
      increase_wisdom: '永久提升悟性',
      increase_speed: '永久提升身法',
      increase_willpower: '永久提升神识',
      defense_boost: '永久提升体魄',
      critical_boost: '永久提升悟性',
    };

    for (const tag of tags) {
      if (effectMap[tag]) return effectMap[tag]!;
    }
    // 默认返回提升灵力
    return '永久提升灵力';
  }
}
