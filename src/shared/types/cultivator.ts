// ===== 新一代修仙底层数据模型 =====

import type { AbilityConfig } from '@shared/engine/creation-v2/contracts/battle';
import type { AttributeModifierConfig } from '@shared/engine/battle-v5/core/configs';
import type { ConsumableSpec, MaterialAlchemyProfile } from '@shared/types/consumable';
import type { CultivatorCondition } from '@shared/types/condition';
import type {
  ConsumableType,
  ElementType,
  EquipmentSlot,
  GenderType,
  MaterialType,
  Quality,
  RealmStage,
  RealmType,
  SpiritualRootGrade,
} from './constants';

/**
 * 基础属性（仅 5 维）。
 *
 * 所有派生属性（暴击率、闪避率、气血上限 等）都由 battle-v5
 * 的 AttributeSystem/AttrsStateView 动态计算，不再写入 DB 与实体。
 *
 * 展示层需要派生属性时，请通过
 *   `CultivatorDisplayAdapter.snapshot(cultivator)` 或
 *   `getCultivatorDisplayAttributes(cultivator)` 取 AttrsStateView。
 */
export interface Attributes {
  vitality: number; // 体魄：伤害减免、气血上限
  spirit: number; // 灵力：法术伤害、蓝量上限
  wisdom: number; // 悟性：暴击率、命中率、效果命中
  speed: number; // 速度：出手顺序、闪避率
  willpower: number; // 神识：暴击抗性、暴击伤害、状态抗性
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
export type FateEffectScope =
  | 'creation'
  | 'cultivation'
  | 'breakthrough'
  | 'world';

export type FateEffectPolarity = 'boon' | 'burden';

export type FateEffectType =
  | 'creation_tag_bias'
  | 'cultivation_exp_multiplier'
  | 'insight_gain_multiplier'
  | 'breakthrough_bonus'
  | 'reward_type_bias'
  | 'reward_score_multiplier'
  | 'encounter_hint';

export type FateEffectExtreme = 'mild' | 'strong' | 'extreme';

export interface FateEffectEntry {
  id: string;
  fragmentId: string;
  scope: FateEffectScope;
  polarity: FateEffectPolarity;
  effectType: FateEffectType;
  value: number;
  tags?: string[];
  rewardTypes?: string[];
  label: string;
  description: string;
  extreme: FateEffectExtreme;
}

export interface FateGenerationModel {
  version: string;
  quality: Quality;
  fragmentIds: string[];
  compositionHash: string;
  primaryDomains: FateEffectScope[];
  qualityTemplateId: string;
  coreKey: string;
  rollStrategy?: 'fully_random' | 'root_restricted';
}

export interface FateNamingMetadata {
  status: 'success' | 'fallback';
  originalName?: string;
  provider?: string;
  styleInsight?: string;
}

export interface PreHeavenFate {
  name: string;
  quality?: Quality;
  description?: string;
  tags?: string[];
  effects?: FateEffectEntry[];
  generationModel?: FateGenerationModel;
  namingMetadata?: FateNamingMetadata;
}

// 功法（被动）
export interface CultivationTechnique {
  id?: string;
  name: string;
  element?: ElementType;
  quality?: Quality;
  score?: number;
  description?: string;
  attributeModifiers?: AttributeModifierConfig[];
  /** Phase 1 过渡期可选：旧数据/排行榜快照可能没有 abilityConfig */
  abilityConfig?: AbilityConfig;
  /** 背包/详情展示链路透传 creation_products.product_model */
  productModel?: unknown;
}

// 技能
export interface Skill {
  id?: string;
  name: string;
  element: ElementType;
  quality?: Quality;
  cost?: number;
  cooldown: number;
  target_self?: boolean;
  description?: string;
  /** Phase 1 过渡期可选：旧数据可能没有 abilityConfig */
  abilityConfig?: AbilityConfig;
  /** 背包/详情展示链路透传 creation_products.product_model */
  productModel?: unknown;
}

export interface Artifact {
  id?: string;
  name: string;
  slot: EquipmentSlot;
  element: ElementType;
  quality?: Quality;
  description?: string;
  attributeModifiers?: AttributeModifierConfig[];
  /** Phase 1 过渡期可选 */
  abilityConfig?: AbilityConfig;
  prompt?: string;
  score?: number;
  /** 背包/列表展示链路透传 creation_products.product_model */
  productModel?: unknown;
  /** 背包/列表展示态 */
  isEquipped?: boolean;
}

export interface Consumable {
  id?: string;
  name: string;
  type: ConsumableType;
  quality?: Quality;
  quantity: number;
  description?: string;
  prompt?: string; // 炼丹提示词
  score?: number; // 评分
  spec: ConsumableSpec;
}

export interface MaterialDetails {
  alchemyProfile?: MaterialAlchemyProfile;
  [key: string]: unknown;
}

export interface Material {
  id?: string;
  name: string;
  type: MaterialType;
  rank: Quality;
  price?: number;
  element?: ElementType;
  description?: string;
  details?: MaterialDetails;
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

  // 兹容现有系统 & AI：保留原 prompt 入口（不进入战斗模型）
  prompt?: string;
  balance_notes?: string;

  // 修为系统
  cultivation_progress?: CultivationProgress;

  // 角色当前状态（用于存储战斗/副本中产生的持久状态）
  condition?: CultivatorCondition;
}
