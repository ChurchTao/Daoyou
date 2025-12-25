// ===== 新一代修仙底层数据模型 =====

import type {
  ConsumableEffectType,
  ConsumableType,
  EffectType,
  ElementType,
  EquipmentSlot,
  GenderType,
  MaterialType,
  Quality,
  RealmStage,
  RealmType,
  SkillGrade,
  SkillType,
  SpiritualRootGrade,
  StatusEffect,
} from './constants';

// 基础属性
export interface Attributes {
  vitality: number; // 体魄：伤害减免、气血上限
  spirit: number; // 灵力：法术伤害、蓝量上限
  wisdom: number; // 悟性：暴击率、突破几率
  speed: number; // 速度：出手顺序、闪避率
  willpower: number; // 神识：状态（暴击）抗性、暴击伤害
}

// 灵根
export interface SpiritualRoot {
  element: ElementType;
  strength: number; // 0-100
  grade?: SpiritualRootGrade; // 天灵根 | 真灵根 | 伪灵根
}

export interface RetreatRecordModifiers {
  comprehension: number;
  years: number;
  failureStreak: number;
}

export interface RetreatRecord {
  realm: RealmType;
  realm_stage: RealmStage;
  years: number;
  success: boolean;
  chance: number;
  roll: number;
  timestamp: string;
  modifiers: RetreatRecordModifiers;
  // 修为系统扩展
  exp_gained?: number; // 本次闭关获得修为
  exp_before?: number; // 闭关前修为
  exp_after?: number; // 闭关后修为
  insight_gained?: number; // 本次闭关获得感悟
  epiphany_triggered?: boolean; // 是否触发顿悟
}

export interface BreakthroughHistoryEntry {
  from_realm: RealmType;
  from_stage: RealmStage;
  to_realm: RealmType;
  to_stage: RealmStage;
  age: number;
  years_spent: number;
  story?: string;
  // 修为系统扩展
  exp_progress?: number; // 突破时的修为进度（0-100百分比）
  insight_value?: number; // 突破时的感悟值
  exp_lost_on_failure?: number; // 失败时损失的修为（仅失败记录有）
  breakthrough_type?: 'forced' | 'normal' | 'perfect'; // 突破类型
}

// 先天命格 / 气运
export interface PreHeavenFateAttributeMod {
  vitality?: number;
  spirit?: number;
  wisdom?: number;
  speed?: number;
  willpower?: number;
}

export interface PreHeavenFate {
  name: string;
  type: '吉' | '凶';
  quality?: Quality; // 凡品 | 灵品 | 玄品 | 真品
  attribute_mod: PreHeavenFateAttributeMod;
  description?: string;
}

// 功法（被动）
export interface CultivationTechnique {
  name: string;
  grade?: SkillGrade; // 天阶上品 | 天阶中品 | ... | 黄阶下品
  bonus: Partial<Attributes>;
  required_realm: RealmType;
}

// 技能
export interface Skill {
  id?: string;
  name: string;
  type: SkillType;
  element: ElementType;
  grade?: SkillGrade; // 天阶上品 | 天阶中品 | ... | 黄阶下品
  power: number; // 30-150
  cost?: number;
  cooldown: number;
  effect?: StatusEffect;
  duration?: number;
  target_self?: boolean;
  description?: string;
}

// 法宝 / 装备
export interface ArtifactBonus {
  vitality?: number;
  spirit?: number;
  wisdom?: number;
  speed?: number;
  willpower?: number;
}

export interface BaseEffect {
  type: EffectType;
  power: number;
}

/**
 * 伤害加成效果
 */
export interface DamageBonusEffect extends BaseEffect {
  type: 'damage_bonus';
  element: ElementType;
  bonus: number;
}

/**
 * 攻击命中后添加状态效果
 */
export interface OnHitAddEffect extends BaseEffect {
  type: 'on_hit_add_effect';
  effect: StatusEffect;
  target_self?: boolean;
  chance: number; // 1-100
}

/**
 * 使用法术消耗气血
 */
export interface OnUseCostHpEffect extends BaseEffect {
  type: 'on_use_cost_hp';
  amount: number;
}

/**
 * 环境变化
 */
export interface EnvironmentChangeEffect extends BaseEffect {
  type: 'environment_change';
  env_type: string;
}

export type ArtifactEffect =
  | DamageBonusEffect
  | OnHitAddEffect
  | OnUseCostHpEffect
  | EnvironmentChangeEffect;

export interface Artifact {
  id?: string;
  name: string;
  slot: EquipmentSlot;
  element: ElementType;
  quality?: Quality;
  required_realm?: RealmType;
  bonus: ArtifactBonus;
  special_effects?: ArtifactEffect[];
  curses?: ArtifactEffect[];
  description?: string;
}

// 永久提升效果
export interface PermanentBonusEffect extends BaseConsumableEffect {
  bonus: number;
}

interface BaseConsumableEffect {
  effect_type: ConsumableEffectType;
}

export type ConsumableEffect = PermanentBonusEffect;

export interface Consumable {
  id?: string;
  name: string;
  type: ConsumableType;
  quality?: Quality;
  effect?: ConsumableEffect[];
  quantity: number;
  description?: string;
}

export interface Material {
  id?: string;
  name: string;
  type: MaterialType;
  rank: Quality;
  price?: number;
  element?: ElementType;
  description?: string;
  details?: Record<string, unknown>;
  quantity: number;
}

export interface Inventory {
  artifacts: Artifact[];
  consumables: Consumable[];
  materials: Material[];
}

export interface EquippedItems {
  weapon: string | null;
  armor: string | null;
  accessory: string | null;
}

// 修为进度系统
export interface CultivationProgress {
  cultivation_exp: number; // 当前修为值
  exp_cap: number; // 当前境界修为上限
  comprehension_insight: number; // 当前感悟值（0-100）
  breakthrough_failures: number; // 连续突破失败次数
  bottleneck_state: boolean; // 是否处于瓶颈期
  inner_demon: boolean; // 是否有心魔debuff
  deviation_risk: number; // 走火入魔风险值（0-100）
  last_epiphany_at?: string; // 上次顿悟时间（ISO字符串）
  epiphany_buff_expires_at?: string; // 顿悟buff过期时间（ISO字符串）
}

// 角色完整数据模型（与 basic.md 中 JSON Schema 对齐的运行时结构）
export interface Cultivator {
  id?: string;
  name: string;
  title?: string | null;
  gender: GenderType;
  origin?: string;
  personality?: string;

  realm: RealmType;
  realm_stage: RealmStage;
  age: number;
  lifespan: number;
  status?: 'active' | 'dead';
  closed_door_years_total?: number;
  retreat_records?: RetreatRecord[];
  breakthrough_history?: BreakthroughHistoryEntry[];

  attributes: Attributes;
  spiritual_roots: SpiritualRoot[];
  pre_heaven_fates: PreHeavenFate[];
  cultivations: CultivationTechnique[];
  skills: Skill[];

  inventory: Inventory;
  equipped: EquippedItems;

  max_skills: number;
  spirit_stones: number;
  last_yield_at?: Date;
  background?: string;

  // 兼容现有系统 & AI：保留原 prompt 入口（不进入战斗模型）
  prompt?: string;
  balance_notes?: string;

  // 修为系统
  cultivation_progress?: CultivationProgress;
}
