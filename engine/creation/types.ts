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
  // 特殊效果
  'critical_boost', // 增加暴击
  'defense_boost', // 增加防御
  'healing_boost', // 增加治疗
  'lifespan_boost', // 增加寿元
  'cultivation_boost', // 增加修为速度
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
