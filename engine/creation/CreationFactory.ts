/**
 * 造物工厂 - 将 AI 蓝图转化为实际物品
 *
 * 核心职责：
 * 1. 根据材料计算品质（非 AI 决定）
 * 2. 根据境界+品质计算属性总值
 * 3. 根据方向标签分配属性
 * 4. 生成特效（数值由配置表控制）
 */

import { EffectType, type EffectConfig } from '@/engine/effect/types';
import type {
  ElementType,
  EquipmentSlot,
  Quality,
  RealmType,
} from '@/types/constants';
import { QUALITY_VALUES, STATUS_EFFECT_VALUES } from '@/types/constants';
import type {
  Artifact,
  ArtifactBonus,
  ArtifactEffect,
  Consumable,
  ConsumableEffect,
} from '@/types/cultivator';
import {
  CREATION_CONFIG,
  hasElementConflict,
  QUALITY_MAX_BONUS_COUNT,
  QUALITY_MAX_EFFECTS,
  QUALITY_MULTIPLIER,
  QUANTITY_HINT_MAP,
  SLOT_ALLOWED_ATTRIBUTES,
} from './creationConfig';
import type {
  ArtifactBlueprint,
  ConsumableBlueprint,
  CurseHint,
  DirectionTag,
  EffectHint,
  MaterialContext,
  ValueRange,
} from './types';

// 内部使用的旧版效果类型（用于 generateEffects/generateCurses）
type OldArtifactEffect = {
  type: string;
  element?: string;
  bonus?: number;
  effect?: string;
  chance?: number;
  amount?: number;
  power?: number;
};

export class CreationFactory {
  // ============ 法宝生成 ============

  /**
   * 将法宝蓝图转化为实际法宝
   */
  static materializeArtifact(
    blueprint: ArtifactBlueprint,
    context: MaterialContext,
  ): Artifact {
    const realm = context.cultivatorRealm as RealmType;
    const config = CREATION_CONFIG[realm] || CREATION_CONFIG['筑基'];
    const quality = this.calculateQuality(context.materials);
    const qualityMultiplier =
      QUALITY_MULTIPLIER[quality] || QUALITY_MULTIPLIER['凡品'];

    // 1. 计算属性总值
    const totalBonus = this.randomInRange(
      config.artifact_bonus,
      qualityMultiplier,
    );

    // 2. 根据槽位和方向标签分配属性
    const bonus = this.distributeBonus(
      blueprint.direction_tags,
      blueprint.slot,
      totalBonus,
      quality,
    );

    // 5. 确定元素（提前计算，用于特效生成）
    const element = this.determineElement(
      blueprint.element_affinity,
      context.materials,
    );

    // 3. 生成特效
    const specialEffects = this.generateEffects(
      blueprint.effect_hints || [],
      quality,
      config,
      element,
    );

    // 4. 生成诅咒（如果材料相克）
    const curses = this.generateCurses(
      blueprint.curse_hints || [],
      context.materials,
      config,
    );

    // 生成 effects 数组
    const effects: EffectConfig[] = [];

    // 将属性加成转换为 StatModifier 效果
    for (const [attr, value] of Object.entries(bonus)) {
      if (value && value > 0) {
        effects.push({
          type: EffectType.StatModifier,
          trigger: 'ON_STAT_CALC',
          params: { attribute: attr, value, modType: 1 },
        });
      }
    }

    // 将特效转换为 effects
    for (const se of specialEffects) {
      effects.push(this.convertOldEffectToConfig(se));
    }

    // 将诅咒转换为 effects
    for (const curse of curses) {
      effects.push(this.convertOldEffectToConfig(curse));
    }

    return {
      name: blueprint.name,
      slot: blueprint.slot,
      element,
      quality,
      required_realm: realm,
      description: blueprint.description,
      effects,
    };
  }

  /**
   * 将旧版特效转换为 EffectConfig
   */
  private static convertOldEffectToConfig(oldEffect: {
    type: string;
    element?: string;
    bonus?: number;
    effect?: string;
    chance?: number;
    amount?: number;
    power?: number;
  }): EffectConfig {
    if (oldEffect.type === 'on_hit_add_effect') {
      return {
        type: EffectType.AddBuff,
        trigger: 'ON_SKILL_HIT',
        params: { buffId: oldEffect.effect, chance: oldEffect.chance },
      };
    }
    return { type: EffectType.NoOp, params: {} };
  }

  // ============ 丹药生成 ============

  /**
   * 将丹药蓝图转化为实际丹药
   */
  static materializeConsumable(
    blueprint: ConsumableBlueprint,
    context: MaterialContext,
  ): Consumable {
    const realm = context.cultivatorRealm as RealmType;
    const config = CREATION_CONFIG[realm] || CREATION_CONFIG['筑基'];
    const quality = this.calculateQuality(context.materials);
    const qualityMultiplier =
      QUALITY_MULTIPLIER[quality] || QUALITY_MULTIPLIER['凡品'];

    // 1. 计算效果值
    const effectValue = this.randomInRange(
      config.consumable_effect,
      qualityMultiplier,
    );

    // 2. 根据方向标签确定效果类型
    const effectType = this.inferConsumableEffectType(blueprint.direction_tags);

    // 3. 确定成丹数量
    const quantityRange =
      QUANTITY_HINT_MAP[blueprint.quantity_hint] || QUANTITY_HINT_MAP['single'];
    // 高品质丹药降低数量
    let quantity = this.randomInt(quantityRange.min, quantityRange.max);
    if (['地品', '天品', '仙品', '神品'].includes(quality) && quantity > 1) {
      quantity = 1;
    }

    const effect: ConsumableEffect[] = [
      {
        effect_type: effectType,
        bonus: effectValue,
      },
    ];

    return {
      name: blueprint.name,
      type: '丹药',
      quality,
      effect,
      quantity,
      description: blueprint.description,
    };
  }

  // ============ 核心计算方法 ============

  /**
   * 根据材料计算物品品质（取材料中的最高品质）
   */
  static calculateQuality(materials: MaterialContext['materials']): Quality {
    const qualityOrder = QUALITY_VALUES;
    let maxIndex = 0;

    for (const mat of materials) {
      const rank = mat.rank as Quality;
      const index = qualityOrder.indexOf(rank);
      if (index > maxIndex) {
        maxIndex = index;
      }
    }

    return qualityOrder[maxIndex];
  }

  /**
   * 根据方向标签和槽位分配属性加成
   */
  private static distributeBonus(
    tags: DirectionTag[],
    slot: EquipmentSlot,
    totalValue: number,
    quality: Quality,
  ): ArtifactBonus {
    const bonus: ArtifactBonus = {};

    // 获取该槽位允许的属性
    const allowedAttrs = SLOT_ALLOWED_ATTRIBUTES[slot] || [
      'vitality',
      'spirit',
      'wisdom',
      'speed',
      'willpower',
    ];

    // 方向标签 → 属性映射
    const attributeMap: Partial<Record<DirectionTag, keyof ArtifactBonus>> = {
      increase_vitality: 'vitality',
      increase_spirit: 'spirit',
      increase_wisdom: 'wisdom',
      increase_speed: 'speed',
      increase_willpower: 'willpower',
      defense_boost: 'vitality',
      critical_boost: 'wisdom',
    };

    // 找出有效的属性标签
    const relevantAttrs: (keyof ArtifactBonus)[] = [];
    for (const tag of tags) {
      const attr = attributeMap[tag];
      if (
        attr &&
        allowedAttrs.includes(attr) &&
        !relevantAttrs.includes(attr)
      ) {
        relevantAttrs.push(attr);
      }
    }

    // 如果没有匹配的属性，随机选一个
    if (relevantAttrs.length === 0) {
      const randomAttr =
        allowedAttrs[Math.floor(Math.random() * allowedAttrs.length)];
      relevantAttrs.push(randomAttr);
    }

    // 根据品质限制属性条数
    const maxCount = QUALITY_MAX_BONUS_COUNT[quality] || 1;
    const finalAttrs = relevantAttrs.slice(0, maxCount);

    // 分配属性值
    const perAttr = Math.max(1, Math.floor(totalValue / finalAttrs.length));
    for (const attr of finalAttrs) {
      bonus[attr] = (bonus[attr] || 0) + perAttr;
    }

    return bonus;
  }

  /**
   * 生成特效
   */
  private static generateEffects(
    hints: EffectHint[],
    quality: Quality,
    config: (typeof CREATION_CONFIG)[RealmType],
    element: ElementType,
  ): OldArtifactEffect[] {
    const effects: OldArtifactEffect[] = [];

    // 获取品质允许的最大特效数
    const maxByQuality = QUALITY_MAX_EFFECTS[quality] || 0;
    const maxEffects = Math.min(config.max_effects, maxByQuality, hints.length);

    if (maxEffects === 0 || hints.length === 0) {
      return effects;
    }

    // 取前 N 个特效
    const selectedHints = hints.slice(0, maxEffects);

    for (const hint of selectedHints) {
      const effect = this.createEffect(hint, config, element);
      if (effect) {
        effects.push(effect);
      }
    }

    return effects;
  }

  /**
   * 根据提示创建单个特效
   */
  private static createEffect(
    hint: EffectHint,
    config: (typeof CREATION_CONFIG)[RealmType],
    element: ElementType,
  ): ArtifactEffect | null {
    const power = this.randomInt(
      config.effect_power.min,
      config.effect_power.max,
    );

    switch (hint.type) {
      case 'damage_boost':
      case 'element_damage':
      case 'defense':
      case 'critical':
        // 所有伤害相关效果使用 DamageBonusEffect
        return {
          type: 'damage_bonus',
          element,
          power,
          bonus:
            ((hint.type === 'defense' ? -1 : 1) *
              this.randomInt(
                config.effect_power.min,
                config.effect_power.max,
              )) /
            100,
        };

      case 'on_hit_status': {
        // 映射 status hint 到游戏内状态
        const statusMap: Record<string, (typeof STATUS_EFFECT_VALUES)[number]> =
          {
            burn: 'burn',
            freeze: 'freezing', // freeze 映射到 freezing
            poison: 'poison',
            stun: 'stun',
            slow: 'root', // slow 映射到 root
            silence: 'silence',
            weaken: 'weakness',
            bleed: 'bleed',
          };
        const statusEffect = hint.status ? statusMap[hint.status] : 'burn';
        return {
          type: 'on_hit_add_effect',
          effect: statusEffect || 'burn',
          chance: this.randomInt(
            config.effect_chance.min,
            config.effect_chance.max,
          ),
          power,
        };
      }

      case 'on_use_cost_hp':
        return {
          type: 'on_use_cost_hp',
          power,
          amount: this.randomInt(
            config.effect_power.min * 5,
            config.effect_power.max * 5,
          ),
        };

      default:
        return null;
    }
  }

  /**
   * 生成诅咒效果
   */
  private static generateCurses(
    hints: CurseHint[],
    materials: MaterialContext['materials'],
    config: (typeof CREATION_CONFIG)[RealmType],
  ): OldArtifactEffect[] {
    const curses: OldArtifactEffect[] = [];

    // 检测材料元素相克
    const elements = materials.map((m) => m.element);
    const hasConflict = hasElementConflict(elements);

    if (!hasConflict && hints.length === 0) {
      return curses;
    }

    const power = this.randomInt(
      config.effect_power.min,
      config.effect_power.max,
    );

    // 如果有元素相克但没有 AI 提示，自动生成诅咒
    if (hasConflict && hints.length === 0) {
      curses.push({
        type: 'on_use_cost_hp',
        power,
        amount: this.randomInt(
          config.effect_power.min * 3,
          config.effect_power.max * 3,
        ),
      });
      return curses;
    }

    // 根据提示生成诅咒
    for (const hint of hints.slice(0, 1)) {
      switch (hint.type) {
        case 'self_damage':
        case 'hp_cost':
          curses.push({
            type: 'on_use_cost_hp',
            power,
            amount: this.randomInt(
              config.effect_power.min * 3,
              config.effect_power.max * 3,
            ),
          });
          break;
        case 'stat_reduction':
          // 暂无对应效果，用 hp_cost 替代
          curses.push({
            type: 'on_use_cost_hp',
            power,
            amount: this.randomInt(
              config.effect_power.min * 2,
              config.effect_power.max * 2,
            ),
          });
          break;
      }
    }

    return curses;
  }

  /**
   * 确定物品元素
   */
  private static determineElement(
    affinityHint: string | undefined,
    materials: MaterialContext['materials'],
  ): ElementType {
    // 优先使用 AI 提示的元素
    if (affinityHint) {
      return affinityHint as ElementType;
    }

    // 从材料中推断
    for (const mat of materials) {
      if (mat.element) {
        return mat.element as ElementType;
      }
    }

    // 默认随机
    const elements: ElementType[] = ['金', '木', '水', '火', '土'];
    return elements[Math.floor(Math.random() * elements.length)];
  }

  /**
   * 推断丹药效果类型
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
    return '永久提升灵力';
  }

  // ============ 工具方法 ============

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
   * 随机整数
   */
  private static randomInt(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1));
  }
}
