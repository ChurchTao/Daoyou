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

// ============ 词条选择 Schema ============

/**
 * 法宝词条选择 Schema
 */
export const ArtifactAffixSelectionSchema = z.object({
  primary: z.array(z.string()).min(1).max(2).describe('主词条ID列表（1-2个）'),
  secondary: z
    .array(z.string())
    .max(5)
    .default([])
    .describe('副词条ID列表（0-5个，根据品质和境界限制）'),
});

export type ArtifactAffixSelection = z.infer<
  typeof ArtifactAffixSelectionSchema
>;

// ============ 法宝蓝图 Schema ============

export const ArtifactBlueprintSchema = z.object({
  name: z.string().min(2).max(10).describe('法宝名称（2-10字，古风霸气）'),
  description: z.string().min(50).max(150).describe('法宝描述（50-150字）'),
  slot: z.enum(EQUIPMENT_SLOT_VALUES).describe('法宝槽位'),
  element_affinity: z.enum(ELEMENT_VALUES).optional().describe('元素亲和'),
  selected_affixes: ArtifactAffixSelectionSchema.describe('AI选择的词条ID'),
});

export type ArtifactBlueprint = z.infer<typeof ArtifactBlueprintSchema>;

// ============ 丹药蓝图 Schema ============

/**
 * 丹药词条选择 Schema
 */
export const ConsumableAffixSelectionSchema = z.object({
  primary: z.string().describe('主效果词条ID（必选1个）'),
  secondary: z.string().optional().describe('副效果词条ID（可选）'),
});

export type ConsumableAffixSelection = z.infer<
  typeof ConsumableAffixSelectionSchema
>;

export const ConsumableBlueprintSchema = z.object({
  name: z.string().min(2).max(10).describe('丹药名称（2-10字，古朴典雅）'),
  description: z.string().min(30).max(100).describe('丹药描述（30-100字）'),
  quantity_hint: z
    .enum(['single', 'medium', 'batch'])
    .describe('成丹数量提示：single=1颗, medium=1-2颗, batch=2-3颗'),
  selected_affixes: ConsumableAffixSelectionSchema.describe('AI选择的词条ID'),
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

// ============ 技能蓝图相关 ============

import { SKILL_TYPE_VALUES } from '@/types/constants';

/**
 * 品阶方向提示 - AI 给出建议，后端决定实际品阶
 * 数值化：low=1-3级(黄阶), medium=4-6级(玄阶), high=7-9级(地阶), extreme=10-12级(天阶)
 */
export const GRADE_HINT_VALUES = [
  'low', // 等级 1-3 (黄阶)
  'medium', // 等级 4-6 (玄阶)
  'high', // 等级 7-9 (地阶)
  'extreme', // 等级 10-12 (天阶)
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
 * 神通词条选择 Schema
 */
export const SkillAffixSelectionSchema = z.object({
  primary: z.string().describe('主效果词条ID（必选1个）'),
  secondary: z.string().optional().describe('副效果词条ID（可选）'),
});

export type SkillAffixSelection = z.infer<typeof SkillAffixSelectionSchema>;

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

  // AI 对五行匹配的评估（可选，用于调试）
  element_match_assessment: z
    .enum(ELEMENT_MATCH_VALUES)
    .optional()
    .describe('AI 对五行契合度的评估（可选）'),

  // AI选择的词条ID
  selected_affixes: SkillAffixSelectionSchema.describe('AI选择的词条ID'),
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
  EffectTrigger,
  EffectType,
  StatModifierType,
} from '@/engine/effect/types';
import type { EquipmentSlot, Quality, SkillGrade } from '@/types/constants';

/**
 * 词条权重配置
 * 用于定义词条池中每个词条的选取概率和适用条件
 */
export interface AffixWeight {
  /** 词条唯一ID（用于AI选择和程序查找） */
  id: string;
  /** 效果类型 */
  effectType: EffectType;
  /** 效果触发时机 (可选，默认根据效果类型自动推断) */
  trigger?: EffectTrigger;
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
  /** AI可读描述（用于提示词展示） */
  displayDescription: string;
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

  /** ModifyHitRate 专用 */
  hitRateBonus?: number | ScalableValue;
  affectsTarget?: boolean;

  // ============================================================
  // 新增效果类型参数
  // ============================================================

  /** ConsumeGainCultivationExp/ConsumeGainComprehension/ConsumeGainLifespan 专用 */
  base?: number;
  scale?: 'quality' | 'realm';
  coefficient?: number;

  /** ConsumeAddBuff 专用 */
  expiryMinutes?: number;
  maxUses?: number;
  drawType?: 'gongfa' | 'skill';

  /** RetreatCultivationBonus/RetreatComprehensionBonus/BreakthroughChanceBonus 专用 */
  bonusPercent?: number;
  maxBonus?: number;
}

/**
 * 可缩放数值
 * 用于表示需要根据品质/境界动态计算的数值
 */
export interface ScalableValue {
  /** 基础值 */
  base: number;
  /** 缩放类型 */
  scale: 'quality' | 'realm' | 'root' | 'wisdom' | 'none';
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
  | 'wind_affinity' // 风属性
  // Fate 新增标签
  | 'stat' // 属性类
  | 'wisdom' // 悟性
  | 'vitality' // 体魄
  | 'spirit' // 灵力
  | 'speed' // 身法
  | 'willpower' // 神识
  | 'crit' // 暴击
  | 'reflect' // 反伤
  | 'defense' // 防御
  | 'mana' // 法力
  | 'heal' // 治疗
  | 'drain' // 吸取
  | 'dodge' // 闪避
  | 'element' // 元素类
  | 'fire' // 火
  | 'water' // 水
  | 'wood' // 木
  | 'metal' // 金
  | 'earth' // 土
  | 'wind' // 风
  | 'thunder' // 雷
  | 'ice' // 冰
  | 'special' // 特殊类
  | 'combat' // 战斗类
  // 新增资源类标签
  | 'resource' // 资源类（修为、感悟、寿命）
  | 'cultivation' // 修为相关
  | 'comprehension' // 感悟相关
  | 'lifespan' // 寿命相关
  | 'retreat' // 闭关相关
  | 'breakthrough'; // 突破相关

/**
 * 词条池配置
 */
export interface AffixPool {
  /** 主词条池 */
  primary: AffixWeight[];
  /** 副词条池 */
  secondary?: AffixWeight[];
  /** 诅咒词条池（可选，用于负面效果） */
  curse?: AffixWeight[];
  /** 持久化 Buff 池（可选，用于消耗品添加持久化状态） */
  buff?: AffixWeight[];
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
  /** 灵根强度（影响技能威力） */
  spiritualRootStrength?: number;
  /** 是否有匹配的灵根属性 */
  hasMatchingElement?: boolean;
  /** 技能品阶（技能专用） */
  skillGrade?: SkillGrade;
  /** 悟性（影响部分词条缩放） */
  wisdom?: number;
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

// ============================================================
// 数值化结果类型（支持随机化元数据）
// ============================================================

/**
 * 数值品质评级
 * - poor: 低于期望值（< 85%）
 * - normal: 正常范围（85% - 115%）
 * - good: 高于期望值（115% - 135%）
 * - perfect: 极品或闪光（>= 135% 或触发闪光）
 */
export type RollQuality = 'poor' | 'normal' | 'good' | 'perfect';

/**
 * 单个词条数值化结果
 * 包含效果配置和随机性元数据
 */
export interface MaterializationResult {
  /** 最终效果配置 */
  effect: EffectConfig;
  /** 是否触发闪光（完美词条） */
  isPerfect: boolean;
  /** 数值品质评级 */
  rollQuality: RollQuality;
  /** 实际波动倍率（相对期望值） */
  variance: number;
  /** 闪光加成倍率（仅闪光时有值） */
  perfectBonus?: number;
}

/**
 * 批量数值化结果
 */
export interface BatchMaterializationResult {
  /** 所有效果配置 */
  effects: EffectConfig[];
  /** 是否存在闪光词条 */
  hasPerfect: boolean;
  /** 闪光词条数量 */
  perfectCount: number;
  /** 各词条的详细结果 */
  details: MaterializationResult[];
}

// ============ 命格蓝图 Schema ============

/**
 * 命格蓝图 Schema - AI 选择词条
 */
export const FateBlueprintSchema = z.object({
  name: z.string().min(2).max(8).describe('命格名称（2-8字）'),
  description: z.string().min(20).max(100).describe('命格描述（20-100字）'),
  fate_type: z.enum(['吉', '凶']).describe('命格类型：吉相或凶相'),
  selected_affixes: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe('AI选择的词条ID（1-3个，根据品质）'),
});

export type FateBlueprint = z.infer<typeof FateBlueprintSchema>;

// ============ 功法蓝图 Schema ============

/**
 * 功法词条选择 Schema
 */
export const GongFaAffixSelectionSchema = z.object({
  primary: z.string().describe('主效果词条ID（必选1个）'),
  secondary: z.string().optional().describe('副效果词条ID（可选）'),
});

export type GongFaAffixSelection = z.infer<typeof GongFaAffixSelectionSchema>;

/**
 * 功法蓝图 Schema
 */
export const GongFaBlueprintSchema = z.object({
  name: z.string().min(2).max(8).describe('功法名称（2-8字，古风）'),
  description: z.string().max(100).describe('功法描述'),
  selected_affixes: GongFaAffixSelectionSchema.describe('AI选择的词条ID'),
});

export type GongFaBlueprint = z.infer<typeof GongFaBlueprintSchema>;
