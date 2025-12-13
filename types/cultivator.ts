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
}

export interface BreakthroughHistoryEntry {
  from_realm: RealmType;
  from_stage: RealmStage;
  to_realm: RealmType;
  to_stage: RealmStage;
  age: number;
  years_spent: number;
  story?: string;
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

// 角色完整数据模型（与 basic.md 中 JSON Schema 对齐的运行时结构）
export interface Cultivator {
  id?: string;
  name: string;
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
}
