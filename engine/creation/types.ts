/**
 * 造物系统 - 类型定义
 *
 * 采用"AI蓝图 + 程序数值化"架构：
 * - AI 生成蓝图（名称、描述、方向性标签）
 * - 程序根据材料品质和修士境界生成具体数值
 */

import { ELEMENT_VALUES, EQUIPMENT_SLOT_VALUES } from '@/types/constants';
import { z } from 'zod';

// ============ 方向性标签 ============

/**
 * 方向性标签 - AI 可以使用的修饰词
 * 程序会将这些标签映射为具体的游戏属性
 */
export const DIRECTION_TAG_VALUES = [
  // 属性方向
  'increase_vitality', // 增加体魄
  'increase_spirit', // 增加灵力
  'increase_wisdom', // 增加悟性
  'increase_speed', // 增加身法
  'increase_willpower', // 增加神识

  // 元素亲和
  'fire_affinity', // 火属性
  'water_affinity', // 水属性
  'wood_affinity', // 木属性
  'metal_affinity', // 金属性
  'earth_affinity', // 土属性
  'thunder_affinity', // 雷属性
  'ice_affinity', // 冰属性
  'wind_affinity', // 风属性

  // 战斗机制导向
  'offensive', // 进攻导向
  'defensive', // 防御导向
  'control', // 控制导向
  'sustain', // 续航导向
  'burst', // 爆发导向

  // 特殊效果
  'critical_boost', // 增加暴击
  'defense_boost', // 增加防御
  'healing_boost', // 增加治疗
  'lifespan_boost', // 增加寿元
  'cultivation_boost', // 增加修为速度
  'lifesteal', // 吸血效果
  'counter', // 反击效果
  'execute', // 斩杀效果
  'true_damage', // 真实伤害
  'mana_regen', // 法力回复
  'dispel', // 驱散效果
] as const;

export type DirectionTag = (typeof DIRECTION_TAG_VALUES)[number];

// ============ 特效类型 ============

/**
 * 特效类型枚举
 */
export const EFFECT_HINT_TYPE_VALUES = [
  'damage_boost', // 伤害加成
  'on_hit_status', // 命中附加状态
  'on_use_cost_hp', // 使用消耗生命
  'element_damage', // 元素伤害
  'defense', // 防御效果
  'critical', // 暴击效果
  'speed', // 速度效果
  'heal', // 治疗效果
] as const;

export type EffectHintType = (typeof EFFECT_HINT_TYPE_VALUES)[number];

/**
 * 状态效果枚举 - 用于 on_hit_status
 */
export const STATUS_HINT_VALUES = [
  'burn', // 灼烧
  'freeze', // 冰冻
  'poison', // 中毒
  'stun', // 眩晕
  'slow', // 减速
  'silence', // 沉默
  'weaken', // 虚弱
  'bleed', // 流血
] as const;

export type StatusHint = (typeof STATUS_HINT_VALUES)[number];

// ============ 特效提示 Schema ============

export const EffectHintSchema = z.object({
  type: z.enum(EFFECT_HINT_TYPE_VALUES).describe('特效类型'),
  status: z
    .enum(STATUS_HINT_VALUES)
    .optional()
    .describe('附加的状态（on_hit_status 类型需要）'),
  description: z
    .string()
    .max(50)
    .describe('AI 对特效的描述，如"命中时有几率使敌人陷入定身"'),
});

export type EffectHint = z.infer<typeof EffectHintSchema>;

// ============ 诅咒提示 Schema ============

export const CurseHintSchema = z.object({
  type: z
    .enum(['self_damage', 'stat_reduction', 'hp_cost'])
    .describe('诅咒类型'),
  description: z.string().max(50).describe('AI 对诅咒的描述'),
});

export type CurseHint = z.infer<typeof CurseHintSchema>;

// ============ 法宝蓝图 Schema ============

export const ArtifactBlueprintSchema = z.object({
  name: z.string().min(2).max(10).describe('法宝名称（2-10字，古风霸气）'),
  description: z.string().min(50).max(150).describe('法宝描述（50-150字）'),
  slot: z.enum(EQUIPMENT_SLOT_VALUES).describe('法宝槽位'),
  direction_tags: z
    .array(z.enum(DIRECTION_TAG_VALUES))
    .min(1)
    .max(3)
    .describe('方向性标签（1-3个，决定属性分配方向）'),
  element_affinity: z.enum(ELEMENT_VALUES).optional().describe('元素亲和'),
  effect_hints: z
    .array(EffectHintSchema)
    .max(2)
    .optional()
    .describe('特效提示（最多2个，具体数值由程序决定）'),
  curse_hints: z
    .array(CurseHintSchema)
    .max(1)
    .optional()
    .describe('诅咒提示（材料相克时触发）'),
});

export type ArtifactBlueprint = z.infer<typeof ArtifactBlueprintSchema>;

// ============ 丹药蓝图 Schema ============

export const ConsumableBlueprintSchema = z.object({
  name: z.string().min(2).max(10).describe('丹药名称（2-10字，古朴典雅）'),
  description: z.string().min(30).max(100).describe('丹药描述（30-100字）'),
  direction_tags: z
    .array(z.enum(DIRECTION_TAG_VALUES))
    .min(1)
    .max(2)
    .describe('方向性标签（1-2个，决定效果类型）'),
  quantity_hint: z
    .enum(['single', 'medium', 'batch'])
    .describe('成丹数量提示：single=1颗, medium=1-2颗, batch=2-3颗'),
});

export type ConsumableBlueprint = z.infer<typeof ConsumableBlueprintSchema>;

// ============ 材料上下文 ============

export interface MaterialContext {
  /** 修士境界 */
  cultivatorRealm: string;
  /** 修士境界阶段 */
  cultivatorRealmStage: string;
  /** 投入的材料列表 */
  materials: Array<{
    name: string;
    rank: string;
    element?: string;
    type: string;
    description?: string;
  }>;
  /** 材料中的最高品质 */
  maxMaterialQuality: string;
}

// ============ 数值范围类型 ============

export interface ValueRange {
  min: number;
  max: number;
}

export interface CreationRangeConfig {
  /** 法宝属性加成总值范围 */
  artifact_bonus: ValueRange;
  /** 特效强度范围 */
  effect_power: ValueRange;
  /** 特效触发几率范围 (%) */
  effect_chance: ValueRange;
  /** 最大特效数量 */
  max_effects: number;
  /** 丹药效果值范围 */
  consumable_effect: ValueRange;
}

// ============ 技能蓝图相关 ============

import { SKILL_TYPE_VALUES, STATUS_EFFECT_VALUES } from '@/types/constants';

/**
 * 品阶方向提示 - AI 给出建议，后端决定实际品阶
 */
export const GRADE_HINT_VALUES = [
  'low', // 黄阶
  'medium', // 玄阶
  'high', // 地阶
  'extreme', // 天阶
] as const;

export type GradeHint = (typeof GRADE_HINT_VALUES)[number];

/**
 * 五行契合度评估 - AI 评估后端会重新验证
 */
export const ELEMENT_MATCH_VALUES = [
  'perfect_match', // 灵根完美匹配 + 武器匹配
  'partial_match', // 部分匹配
  'no_match', // 不匹配
  'conflict', // 五行相克
] as const;

export type ElementMatch = (typeof ELEMENT_MATCH_VALUES)[number];

/**
 * 技能特效提示 Schema
 */
export const SkillEffectHintSchema = z.object({
  type: z
    .enum(['status', 'buff', 'debuff', 'none'])
    .describe('效果类型：status=附加状态, buff=增益, debuff=异常, none=无'),
  status: z.enum(STATUS_EFFECT_VALUES).optional().describe('附加的状态效果'),
  target_self: z.boolean().default(false).describe('是否作用于自身'),
});

export type SkillEffectHint = z.infer<typeof SkillEffectHintSchema>;

/**
 * 技能蓝图 Schema - AI 只生成创意部分
 *
 * 数值（power, cost, cooldown, grade）由后端 SkillFactory 计算
 */
export const SkillBlueprintSchema = z.object({
  name: z.string().min(2).max(8).describe('技能名称（古风修仙）'),
  type: z.enum(SKILL_TYPE_VALUES).describe('技能类型'),
  element: z.enum(ELEMENT_VALUES).describe('技能元素'),
  description: z.string().max(180).describe('技能描述（施法表现、视觉效果）'),

  // AI 给出品阶方向提示，后端最终决定
  grade_hint: z
    .enum(GRADE_HINT_VALUES)
    .describe('品阶提示：low=黄阶, medium=玄阶, high=地阶, extreme=天阶'),

  // 特效提示（可选）
  effect_hint: SkillEffectHintSchema.optional().describe(
    '特效提示（attack/heal 类型应设为 none）',
  ),

  // AI 对五行匹配的评估（后端会重新验证）
  element_match_assessment: z
    .enum(ELEMENT_MATCH_VALUES)
    .describe('AI 对五行契合度的评估'),
});

export type SkillBlueprint = z.infer<typeof SkillBlueprintSchema>;

// ============ 技能上下文 ============

import type { ElementType, RealmType } from '@/types/constants';
import type { PreHeavenFate, SpiritualRoot } from '@/types/cultivator';

export interface SkillContext {
  /** 修士境界 */
  realm: RealmType;
  /** 修士境界阶段 */
  realmStage: string;
  /** 修士悟性 */
  wisdom: number;
  /** 修士灵根 */
  spiritualRoots: SpiritualRoot[];
  /** 装备的武器元素 */
  weaponElement?: ElementType;
  /** 先天命格 */
  fates?: PreHeavenFate[];
}

// ============================================================
// 词条系统类型定义
// ============================================================

import type {
  EffectConfig,
  EffectType,
  StatModifierType,
} from '@/engine/effect/types';
import type { EquipmentSlot, Quality, SkillGrade } from '@/types/constants';

/**
 * 词条权重配置
 * 用于定义词条池中每个词条的选取概率和适用条件
 */
export interface AffixWeight {
  /** 效果类型 */
  effectType: EffectType;
  /** 效果触发时机 (可选，默认根据效果类型自动推断) */
  trigger?: string;
  /** 效果参数模板 (数值字段使用 'SCALE' 占位符，由 EffectMaterializer 填充) */
  paramsTemplate: AffixParamsTemplate;
  /** 权重（用于随机选取，数值越大概率越高） */
  weight: number;
  /** 适用槽位（仅法宝词条使用） */
  slots?: EquipmentSlot[];
  /** 最低品质要求 */
  minQuality?: Quality;
  /** 最高品质要求 */
  maxQuality?: Quality;
  /** 标签（用于筛选和分类） */
  tags?: AffixTag[];
  /** 显示名称（用于蓝图描述） */
  displayName: string;
}

/**
 * 词条参数模板
 * 固定值直接填写，需要根据品质/境界缩放的值使用特殊标记
 */
export interface AffixParamsTemplate {
  /** StatModifier 专用 */
  stat?: string;
  modType?: StatModifierType;
  /**
   * 数值字段 - 使用 ScalableValue 表示可缩放的数值
   * 例如: { base: 10, scale: 'quality' } 表示基础值10，按品质缩放
   */
  value?: number | ScalableValue;

  /** Damage 专用 */
  multiplier?: number | ScalableValue;
  element?: ElementType | 'INHERIT'; // INHERIT 表示继承物品元素
  flatDamage?: number | ScalableValue;
  canCrit?: boolean;
  critRateBonus?: number | ScalableValue;
  critDamageBonus?: number | ScalableValue;
  ignoreDefense?: boolean;

  /** Heal 专用 */
  targetSelf?: boolean;
  flatHeal?: number | ScalableValue;

  /** AddBuff 专用 */
  buffId?: string;
  chance?: number | ScalableValue;
  durationOverride?: number;
  initialStacks?: number;

  /** DotDamage 专用 */
  baseDamage?: number | ScalableValue;
  usesCasterStats?: boolean;

  /** Shield 专用 */
  amount?: number | ScalableValue;
  duration?: number;
  absorbElement?: ElementType;

  /** LifeSteal 专用 */
  stealPercent?: number | ScalableValue;

  /** ReflectDamage 专用 */
  reflectPercent?: number | ScalableValue;

  /** DamageReduction 专用 */
  flatReduction?: number | ScalableValue;
  percentReduction?: number | ScalableValue;
  maxReduction?: number;

  /** Critical 专用 */
  // critRateBonus 和 critDamageBonus 已在 Damage 中定义

  // ============================================================
  // P0/P1 新增效果类型参数
  // ============================================================

  /** ElementDamageBonus 专用 */
  damageBonus?: number | ScalableValue;

  /** HealAmplify 专用 */
  amplifyPercent?: number | ScalableValue;
  affectOutgoing?: boolean;

  /** ManaRegen 专用 */
  percentOfMax?: number | ScalableValue;

  /** ManaDrain 专用 */
  drainPercent?: number | ScalableValue;
  drainAmount?: number | ScalableValue;
  restoreToSelf?: boolean;

  /** Dispel 专用 */
  dispelCount?: number;
  dispelType?: 'buff' | 'debuff' | 'all';
  priorityTags?: string[];

  /** ExecuteDamage 专用 */
  thresholdPercent?: number;
  bonusDamage?: number | ScalableValue;
  affectShield?: boolean;

  /** TrueDamage 专用 */
  ignoreShield?: boolean;
  ignoreReduction?: boolean;

  /** CounterAttack 专用 */
  damageMultiplier?: number | ScalableValue;
}

/**
 * 可缩放数值
 * 用于表示需要根据品质/境界动态计算的数值
 */
export interface ScalableValue {
  /** 基础值 */
  base: number;
  /** 缩放类型 */
  scale: 'quality' | 'realm' | 'wisdom' | 'none';
  /** 可选的缩放系数 */
  coefficient?: number;
}

/**
 * 词条标签
 */
export type AffixTag =
  | 'primary' // 主词条
  | 'secondary' // 副词条
  | 'curse' // 诅咒词条
  | 'offensive' // 攻击类
  | 'defensive' // 防御类
  | 'utility' // 功能类
  | 'healing' // 治疗类
  | 'control' // 控制类
  | 'dot' // 持续伤害
  | 'buff' // 增益
  | 'debuff' // 减益
  // P0/P1 新增标签
  | 'sustain' // 续航类
  | 'burst' // 爆发类
  | 'lifesteal' // 吸血类
  | 'counter' // 反击类
  | 'execute' // 斩杀类
  | 'true_damage' // 真实伤害
  | 'mana_regen' // 法力回复
  | 'healing_boost' // 治疗增幅
  | 'dispel' // 驱散类
  // 元素亲和标签
  | 'fire_affinity' // 火属性
  | 'water_affinity' // 水属性
  | 'wood_affinity' // 木属性
  | 'metal_affinity' // 金属性
  | 'earth_affinity' // 土属性
  | 'thunder_affinity' // 雷属性
  | 'ice_affinity' // 冰属性
  | 'wind_affinity'; // 风属性

/**
 * 词条池配置
 */
export interface AffixPool {
  /** 主词条池 */
  primary: AffixWeight[];
  /** 副词条池 */
  secondary: AffixWeight[];
  /** 诅咒词条池（可选，用于负面效果） */
  curse?: AffixWeight[];
}

/**
 * 效果数值化上下文
 * 提供数值计算所需的所有信息
 */
export interface MaterializationContext {
  /** 修士境界 */
  realm: RealmType;
  /** 物品品质 */
  quality: Quality;
  /** 物品元素 */
  element?: ElementType;
  /** 悟性（影响技能威力） */
  wisdom?: number;
  /** 五行契合度（技能专用） */
  elementMatch?: ElementMatch;
  /** 技能品阶（技能专用） */
  skillGrade?: SkillGrade;
}

/**
 * 词条生成结果
 */
export interface AffixGenerationResult {
  /** 生成的效果配置数组 */
  effects: EffectConfig[];
  /** 选中的词条信息（用于调试/展示） */
  selectedAffixes: {
    displayName: string;
    effectType: EffectType;
    tags: AffixTag[];
  }[];
}
