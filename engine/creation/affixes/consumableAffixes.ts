/**
 * 丹药词条池配置
 *
 * 丹药效果分为：
 * - 永久属性提升：服用后永久增加属性（通过特殊触发器实现）
 * - 临时增益：服用后获得临时 Buff
 * - 特殊效果：修为增加、寿元增加等
 */

import {
  EffectTrigger,
  EffectType,
  StatModifierType,
} from '@/engine/effect/types';
import type { AffixPool, AffixWeight } from '../types';

// ============================================================
// 词条ID常量
// ============================================================

export const CONSUMABLE_AFFIX_IDS = {
  // 主词条 - 永久属性提升
  PRIMARY_VITALITY: 'consumable_p_vitality',
  PRIMARY_SPIRIT: 'consumable_p_spirit',
  PRIMARY_WISDOM: 'consumable_p_wisdom',
  PRIMARY_SPEED: 'consumable_p_speed',
  PRIMARY_WILLPOWER: 'consumable_p_willpower',
  // 副词条 - 临时增益
  SECONDARY_SPIRIT_BUFF: 'consumable_s_spirit_buff',
  SECONDARY_VITALITY_BUFF: 'consumable_s_vitality_buff',
  SECONDARY_HEAL: 'consumable_s_heal',
  SECONDARY_SHIELD: 'consumable_s_shield',
  SECONDARY_CRIT_BUFF: 'consumable_s_crit_buff',
  SECONDARY_MANA_RESTORE: 'consumable_s_mana_restore',
  SECONDARY_BERSERK: 'consumable_s_berserk',
  SECONDARY_TURTLE_DEFENSE: 'consumable_s_turtle_defense',
  SECONDARY_EPIPHANY: 'consumable_s_epiphany',
  SECONDARY_HEAL_AMPLIFY: 'consumable_s_heal_amplify',
  // 诅咒词条
  CURSE_VIOLENT: 'consumable_c_violent',
  CURSE_POISON: 'consumable_c_poison',
} as const;

// ============================================================
// 主词条池 - 永久属性提升
// ============================================================

const PRIMARY_AFFIXES: AffixWeight[] = [
  // 永久体魄提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_VITALITY,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_CONSUME, // 特殊触发器：服用时触发，永久生效
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.FIXED,
      value: { base: 3, scale: 'realm', coefficient: 0.5 },
    },
    weight: 100,
    tags: ['primary', 'defensive'],
    displayName: '永久提升体魄',
    displayDescription: '永久增加体魄属性，数值随境界提升',
  },
  // 永久灵力提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_SPIRIT,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.FIXED,
      value: { base: 3, scale: 'realm', coefficient: 0.5 },
    },
    weight: 100,
    tags: ['primary', 'offensive'],
    displayName: '永久提升灵力',
    displayDescription: '永久增加灵力属性，数值随境界提升',
  },
  // 永久悟性提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_WISDOM,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'wisdom',
      modType: StatModifierType.FIXED,
      value: { base: 2, scale: 'realm', coefficient: 0.3 },
    },
    weight: 70,
    minQuality: '玄品',
    tags: ['primary', 'utility'],
    displayName: '永久提升悟性',
    displayDescription: '永久增加悟性属性，数值随境界提升',
  },
  // 永久速度提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_SPEED,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'speed',
      modType: StatModifierType.FIXED,
      value: { base: 2, scale: 'realm', coefficient: 0.3 },
    },
    weight: 80,
    tags: ['primary', 'utility'],
    displayName: '永久提升速度',
    displayDescription: '永久增加速度属性，数值随境界提升',
  },
  // 永久神识提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_WILLPOWER,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'willpower',
      modType: StatModifierType.FIXED,
      value: { base: 2, scale: 'realm', coefficient: 0.3 },
    },
    weight: 80,
    tags: ['primary', 'defensive'],
    displayName: '永久提升神识',
    displayDescription: '永久增加神识属性，数值随境界提升',
  },
];

// ============================================================
// 副词条池 - 临时增益/特殊效果
// ============================================================

const SECONDARY_AFFIXES: AffixWeight[] = [
  // 临时攻击力增益
  {
    id: CONSUMABLE_AFFIX_IDS.SECONDARY_SPIRIT_BUFF,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      buffId: 'spirit_boost',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 50,
    minQuality: '真品',
    tags: ['secondary', 'buff', 'offensive'],
    displayName: '临时灵力增幅',
    displayDescription: '服用后临时提升灵力，持续3回合',
  },
  // 临时防御增益
  {
    id: CONSUMABLE_AFFIX_IDS.SECONDARY_VITALITY_BUFF,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      buffId: 'vitality_boost',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 50,
    minQuality: '真品',
    tags: ['secondary', 'buff', 'defensive'],
    displayName: '临时体魄增幅',
    displayDescription: '服用后临时提升体魄，持续3回合',
  },
  // 恢复生命
  {
    id: CONSUMABLE_AFFIX_IDS.SECONDARY_HEAL,
    effectType: EffectType.Heal,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      multiplier: { base: 0.2, scale: 'quality', coefficient: 0.1 },
      targetSelf: true,
    },
    weight: 60,
    tags: ['secondary', 'healing'],
    displayName: '恢复生命',
    displayDescription: '服用后立即恢复生命值',
  },
  // 护盾
  {
    id: CONSUMABLE_AFFIX_IDS.SECONDARY_SHIELD,
    effectType: EffectType.Shield,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      amount: { base: 100, scale: 'realm', coefficient: 5 },
      duration: 3,
    },
    weight: 40,
    minQuality: '地品',
    tags: ['secondary', 'defensive'],
    displayName: '获得护盾',
    displayDescription: '服用后获得护盾，持续3回合',
  },
  // 暴击率临时提升
  {
    id: CONSUMABLE_AFFIX_IDS.SECONDARY_CRIT_BUFF,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      buffId: 'crit_boost',
      durationOverride: 5,
      targetSelf: true,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'buff', 'offensive'],
    displayName: '暴击增幅',
    displayDescription: '服用后提升暴击率，持续5回合',
  },

  // ============================================================
  // P0/P1 新增丹药效果
  // ============================================================

  // 回蓝丹
  {
    id: CONSUMABLE_AFFIX_IDS.SECONDARY_MANA_RESTORE,
    effectType: EffectType.ManaRegen,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      percentOfMax: { base: 0.4, scale: 'quality', coefficient: 0.15 },
    },
    weight: 45,
    minQuality: '玄品',
    tags: ['secondary', 'sustain', 'mana_regen'],
    displayName: '恢复法力',
    displayDescription: '服用后立即恢复法力值',
  },

  // 狂暴丹
  {
    id: CONSUMABLE_AFFIX_IDS.SECONDARY_BERSERK,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      buffId: 'berserk',
      durationOverride: 3,
      targetSelf: true,
    },
    weight: 35,
    minQuality: '地品',
    tags: ['secondary', 'buff', 'offensive', 'burst'],
    displayName: '狂暴增幅',
    displayDescription: '服用后进入狂暴状态，大幅提升伤害',
  },

  // 龟息丹
  {
    id: CONSUMABLE_AFFIX_IDS.SECONDARY_TURTLE_DEFENSE,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      buffId: 'turtle_defense',
      durationOverride: 2,
      targetSelf: true,
    },
    weight: 30,
    minQuality: '地品',
    tags: ['secondary', 'buff', 'defensive'],
    displayName: '极限防御',
    displayDescription: '服用后进入龟息状态，大幅提升防御',
  },

  // 顿悟丹
  {
    id: CONSUMABLE_AFFIX_IDS.SECONDARY_EPIPHANY,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      buffId: 'epiphany',
      durationOverride: -1, // 战斗内永久
      targetSelf: true,
    },
    weight: 20,
    minQuality: '天品',
    tags: ['secondary', 'buff', 'burst'],
    displayName: '顿悟状态',
    displayDescription: '服用后进入顿悟状态，战斗内永久生效',
  },

  // 治疗增幅
  {
    id: CONSUMABLE_AFFIX_IDS.SECONDARY_HEAL_AMPLIFY,
    effectType: EffectType.HealAmplify,
    trigger: EffectTrigger.ON_HEAL,
    paramsTemplate: {
      amplifyPercent: { base: 0.2, scale: 'quality', coefficient: 0.1 },
      affectOutgoing: false,
    },
    weight: 25,
    minQuality: '真品',
    tags: ['secondary', 'healing_boost'],
    displayName: '增强受疗',
    displayDescription: '增强受到的治疗效果',
  },
];

// ============================================================
// 诅咒词条池 - 负面效果（低品质或炼制失败）
// ============================================================

const CURSE_AFFIXES: AffixWeight[] = [
  // 药性剧烈，损耗寿元（概念性，需要特殊处理）
  {
    id: CONSUMABLE_AFFIX_IDS.CURSE_VIOLENT,
    effectType: EffectType.StatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.FIXED,
      value: -2,
    },
    weight: 50,
    maxQuality: '灵品',
    tags: ['curse'],
    displayName: '药性剧烈',
    displayDescription: '药性过于剧烈，会造成体魄损耗',
  },
  // 药毒残留
  {
    id: CONSUMABLE_AFFIX_IDS.CURSE_POISON,
    effectType: EffectType.AddBuff,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      buffId: 'poison',
      durationOverride: 2,
      targetSelf: true,
    },
    weight: 30,
    maxQuality: '凡品',
    tags: ['curse', 'dot'],
    displayName: '药毒残留',
    displayDescription: '丹药中残留毒素，服用后会中毒',
  },
];

// ============================================================
// 导出词条池
// ============================================================

export const CONSUMABLE_AFFIX_POOL: AffixPool = {
  primary: PRIMARY_AFFIXES,
  secondary: SECONDARY_AFFIXES,
  curse: CURSE_AFFIXES,
};
