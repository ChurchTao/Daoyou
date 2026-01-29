/**
 * 丹药词条池配置
 *
 * 词条类型：
 * - 主词条：永久属性提升（体魄、灵力、悟性、速度、神识）
 * - 资源增益词条：修为、感悟、寿元
 * - 持久化 Buff 词条：闭关加成、突破加成
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

  // 资源增益类
  CULTIVATION_EXP: 'consumable_cultivation_exp',
  COMPREHENSION: 'consumable_comprehension',
  LIFESPAN: 'consumable_lifespan',

  // 持久化 Buff 类
  BUFF_RETREAT_CULTIVATION: 'consumable_buff_retreat_cultivation',
  BUFF_RETREAT_COMPREHENSION: 'consumable_buff_retreat_comprehension',
  BUFF_BREAKTHROUGH_CHANCE: 'consumable_buff_breakthrough_chance',
} as const;

// ============================================================
// 主词条池 - 永久属性提升
// ============================================================

const PRIMARY_AFFIXES: AffixWeight[] = [
  // 永久体魄提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_VITALITY,
    effectType: EffectType.ConsumeStatModifier,
    trigger: EffectTrigger.ON_CONSUME, // 特殊触发器：服用时触发，永久生效
    paramsTemplate: {
      stat: 'vitality',
      modType: StatModifierType.FIXED,
      value: { base: 3, scale: 'quality', coefficient: 0.5 },
    },
    weight: 100,
    tags: ['primary', 'defensive'],
    displayName: '永久提升体魄',
    displayDescription: '永久增加体魄属性，数值随境界提升',
  },
  // 永久灵力提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_SPIRIT,
    effectType: EffectType.ConsumeStatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'spirit',
      modType: StatModifierType.FIXED,
      value: { base: 3, scale: 'quality', coefficient: 0.5 },
    },
    weight: 100,
    tags: ['primary', 'offensive'],
    displayName: '永久提升灵力',
    displayDescription: '永久增加灵力属性，数值随境界提升',
  },
  // 永久悟性提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_WISDOM,
    effectType: EffectType.ConsumeStatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'wisdom',
      modType: StatModifierType.FIXED,
      value: { base: 2, scale: 'quality', coefficient: 0.3 },
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
    effectType: EffectType.ConsumeStatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'speed',
      modType: StatModifierType.FIXED,
      value: { base: 2, scale: 'quality', coefficient: 0.3 },
    },
    weight: 80,
    tags: ['primary', 'utility'],
    displayName: '永久提升速度',
    displayDescription: '永久增加速度属性，数值随境界提升',
  },
  // 永久神识提升
  {
    id: CONSUMABLE_AFFIX_IDS.PRIMARY_WILLPOWER,
    effectType: EffectType.ConsumeStatModifier,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      stat: 'willpower',
      modType: StatModifierType.FIXED,
      value: { base: 2, scale: 'quality', coefficient: 0.3 },
    },
    weight: 80,
    tags: ['primary', 'defensive'],
    displayName: '永久提升神识',
    displayDescription: '永久增加神识属性，数值随境界提升',
  },
];

// ============================================================
// 副词条池 - 资源增益类
// ============================================================

const SECONDARY_AFFIXES: AffixWeight[] = [
  // 修为丹
  {
    id: CONSUMABLE_AFFIX_IDS.CULTIVATION_EXP,
    effectType: EffectType.ConsumeGainCultivationExp,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      base: 50,
      scale: 'realm',
      coefficient: 30,
    },
    weight: 100,
    tags: ['resource', 'cultivation', 'secondary'],
    displayName: '获得修为',
    displayDescription: '服用后获得修为，数值随境界提升',
  },

  // 悟性丹
  {
    id: CONSUMABLE_AFFIX_IDS.COMPREHENSION,
    effectType: EffectType.ConsumeGainComprehension,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      base: 2,
      scale: 'quality',
      coefficient: 3,
    },
    weight: 80,
    minQuality: '灵品',
    tags: ['resource', 'comprehension', 'secondary'],
    displayName: '获得感悟',
    displayDescription: '服用后获得道心感悟，数值随品质提升',
  },

  // 寿元丹
  {
    id: CONSUMABLE_AFFIX_IDS.LIFESPAN,
    effectType: EffectType.ConsumeGainLifespan,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      base: 5,
      scale: 'quality',
      coefficient: 2,
    },
    weight: 60,
    minQuality: '玄品',
    tags: ['resource', 'lifespan', 'secondary'],
    displayName: '增加寿元',
    displayDescription: '服用后增加寿元，数值随品质提升',
  },
];

// ============================================================
// 诅咒词条池 - 负面效果（低品质或炼制失败）
// ============================================================
// 已移除：诅咒词条已从丹药系统中移除

const CURSE_AFFIXES: AffixWeight[] = [];

// ============================================================
// 持久化 Buff 词条池 - 闭关/突破加成
// ============================================================

const BUFF_AFFIXES: AffixWeight[] = [
  // 闭关修为加成
  {
    id: CONSUMABLE_AFFIX_IDS.BUFF_RETREAT_CULTIVATION,
    effectType: EffectType.ConsumeAddBuff,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      buffId: 'pill_enlightenment_state',
      expiryMinutes: 360, // 6 小时（游戏内时间）
      initialStacks: 1,
    },
    weight: 50,
    minQuality: '真品',
    tags: ['buff', 'retreat', 'cultivation'],
    displayName: '闭关修为加成',
    displayDescription: '服用后一段时间内闭关修为获取效率提升',
  },

  // 闭关感悟加成
  {
    id: CONSUMABLE_AFFIX_IDS.BUFF_RETREAT_COMPREHENSION,
    effectType: EffectType.ConsumeAddBuff,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      buffId: 'pill_insight_state',
      expiryMinutes: 360, // 6 小时
      initialStacks: 1,
    },
    weight: 50,
    minQuality: '真品',
    tags: ['buff', 'retreat', 'comprehension'],
    displayName: '闭关感悟加成',
    displayDescription: '服用后一段时间内闭关感悟获取效率提升',
  },

  // 突破成功率加成
  {
    id: CONSUMABLE_AFFIX_IDS.BUFF_BREAKTHROUGH_CHANCE,
    effectType: EffectType.ConsumeAddBuff,
    trigger: EffectTrigger.ON_CONSUME,
    paramsTemplate: {
      buffId: 'breakthrough_luck',
      expiryMinutes: 360, // 6 小时
      initialStacks: 1,
    },
    weight: 40,
    minQuality: '真品',
    tags: ['buff', 'breakthrough'],
    displayName: '突破成功率加成',
    displayDescription: '服用后一段时间内突破成功率提升',
  },
];

// ============================================================
// 导出词条池
// ============================================================

export const CONSUMABLE_AFFIX_POOL: AffixPool = {
  primary: PRIMARY_AFFIXES,
  secondary: SECONDARY_AFFIXES,
  curse: CURSE_AFFIXES,
  buff: BUFF_AFFIXES,
};
