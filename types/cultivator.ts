// ===== 新一代修仙底层数据模型 =====

import type { EffectConfig } from '@/engine/effect/types';
import type {
  ConsumableType,
  ElementType,
  EquipmentSlot,
  GenderType,
  MaterialType,
  Quality,
  RealmStage,
  RealmType,
  SkillGrade,
  SpiritualRootGrade,
} from './constants';

// 基础属性
export interface Attributes {
  vitality: number; // 体魄：伤害减免、气血上限
  spirit: number; // 灵力：法术伤害、蓝量上限
  wisdom: number; // 悟性：暴击率、命中率、效果命中
  speed: number; // 速度：出手顺序、闪避率
  willpower: number; // 神识：暴击抗性、暴击伤害、状态抗性

  critRate?: number; // 暴击率
  critDamage?: number; // 暴击伤害
  damageReduction?: number; // 伤害减免
  flatDamageReduction?: number; // 固定减伤
  hitRate?: number; // 命中率
  dodgeRate?: number; // 闪避率
}

// 灵根
export interface SpiritualRoot {
  element: ElementType;
  strength: number; // 0-100
  grade?: SpiritualRootGrade; // 天灵根 | 真灵根 | 伪灵根 | 变异灵根
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
  quality?: Quality; // 凡品 | 灵品 | 玄品 | 真品
  effects?: EffectConfig[];
  description?: string;
}

// 功法（被动）
export interface CultivationTechnique {
  id?: string;
  name: string;
  grade?: SkillGrade;
  required_realm: RealmType;
  description?: string;
  effects?: EffectConfig[]; // 替代 bonus
}

// 技能
export interface Skill {
  id?: string;
  name: string;
  element: ElementType;
  grade?: SkillGrade;
  cost?: number;
  cooldown: number;
  target_self?: boolean;
  description?: string;
  effects?: EffectConfig[]; // 替代 power/effect/duration
}

export interface Artifact {
  id?: string;
  name: string;
  slot: EquipmentSlot;
  element: ElementType;
  quality?: Quality;
  required_realm?: RealmType;
  description?: string;
  effects?: EffectConfig[]; // 替代 bonus/special_effects/curses
  prompt?: string; // 炼器提示词
  score?: number; // 评分
}

export interface Consumable {
  id?: string;
  name: string;
  type: ConsumableType;
  quality?: Quality;
  effects?: EffectConfig[];
  quantity: number;
  description?: string;
  prompt?: string; // 炼丹提示词
  score?: number; // 评分
  details?: Record<string, unknown>; // 符箓配置等额外数据
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

// 符箓配置（用于消耗品的details字段）
export interface TalismanConfig {
  buffId: string;
  expiryDays: number;
  maxUses?: number;
  fatesPerUse?: number;
  drawType?: 'gongfa' | 'skill';
}

// 符箓Buff元数据（用于BuffInstance的metadata字段）
export interface TalismanBuffMetadata {
  usesRemaining?: number;
  expiresAt: number;
  drawType?: 'gongfa' | 'skill';
  [key: string]: unknown;
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

  // 兹容现有系统 & AI：保留原 prompt 入口（不进入战斗模型）
  prompt?: string;
  balance_notes?: string;

  // 修为系统
  cultivation_progress?: CultivationProgress;

  // 持久状态（用于存储战斗/副本中产生的持久状态）
  persistent_statuses?: unknown; // JSONB field from database
}
