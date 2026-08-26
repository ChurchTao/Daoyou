// ===== 基础类型 =====
export type UnitId = string;
export type TeamId = string;
export type TeamSlot = 0 | 1 | 2 | 3;
export type AbilityId = string;
export type BuffId = string;
export type EventPriority = number;

import type { CombatOriginV3, CombatTraceV3 } from '../v3/types';
import type { CombatResolutionContext } from './resolution';

// ===== 战斗事件基类 =====
export interface CombatEvent {
  readonly type: string;
  readonly timestamp: number;
  readonly trace?: CombatTraceV3;
  readonly origin?: CombatOriginV3;
  /** Action/cast/hit identity; distinct from causal trace identity. */
  readonly resolution?: CombatResolutionContext;
}

// ===== 六维属性类型 =====
export enum AttributeType {
  // ── 主属性（六维）──
  VITALITY = 'vitality', // 体魄：气血上限、少量法术防御
  STRENGTH = 'strength', // 力道：物理攻击
  SPIRIT = 'spirit', // 灵力：法术攻击、少量法力
  ENDURANCE = 'endurance', // 根骨：物理防御、少量气血上限
  SPEED = 'speed', // 身法：行动速度、闪避率、命中
  WILLPOWER = 'willpower', // 神识：法防、法力、控制命中与抗性

  // ── 派生型二级属性（base 由主属性公式推算，modifier 可叠加）──
  ATK = 'atk', // 物理攻击：40 + STRENGTH×3.5
  DEF = 'def', // 物理防御：10 + ENDURANCE×1.75
  MAGIC_ATK = 'magicAtk', // 法术攻击：40 + SPIRIT×3.5
  MAGIC_DEF = 'magicDef', // 法术防御：10 + WILLPOWER×1.75 + VITALITY×0.25
  ACTION_SPEED = 'actionSpeed', // 行动速度：SPEED
  CRIT_RATE = 'critRate', // 暴击率：基础 5%，外部构筑注入
  CRIT_DAMAGE_MULT = 'critDamageMult', // 暴击伤害倍率：基础 1.5
  EVASION_RATE = 'evasionRate', // 闪避率：0.02 + curve(SPEED, 240, 0.24)
  ACCURACY = 'accuracy', // 命中：0.05 + curve(SPEED, 240, 0.27)
  CONTROL_HIT = 'controlHit', // 控制命中：0.04 + curve(WILLPOWER, 240, 0.30)
  CONTROL_RESISTANCE = 'controlResistance', // 控制抗性：0.04 + curve(WILLPOWER, 240, 0.34)
  MAX_HP = 'maxHp', // 最大气血：400 + VITALITY×20 + ENDURANCE×3
  MAX_MP = 'maxMp', // 最大法力：200 + SPIRIT×4 + WILLPOWER×10

  // ── 外部注入型二级属性（base=0，完全由装备/Buff/命格提供）──
  ARMOR_PENETRATION = 'armorPenetration', // 破防：抵消目标减伤率 (0~1)
  MAGIC_PENETRATION = 'magicPenetration', // 法术穿透：削减目标法防 (0~1)
  CRIT_RESIST = 'critResist', // 暴击韧性：降低对手暴击率 (0~1)
  CRIT_DAMAGE_REDUCTION = 'critDamageReduction', // 暴击减伤：降低受到暴击倍率 (0~0.5)
  HEAL_AMPLIFY = 'healAmplify', // 治疗增强 (≥0)
  HEAL_RECEIVED_REDUCTION = 'healReceivedReduction', // 受到的气血治疗削弱 (0~1)
}

// ===== 属性修改器类型（6阶段）=====
export enum ModifierType {
  BASE = 'base',
  FIXED = 'fixed',
  ADD = 'add',
  /**
   * 累乘修正：每个 MULTIPLY modifier 的 value 作为独立乘数，最终结果为所有 value 连乘。
   *
   * 计算公式（来自 AttributeSet.getFinalValue）：
   *   `final *= modifiers.filter(MULTIPLY).reduce((p, m) => p * m.value, 1)`
   *
   * 用途示例：
   * - value = 1.5 → 提升 50%（×1.5）
   * - value = 0.7 → 降低 30%（×0.7）
   *
   * 与 ADD 的区别：ADD 是百分比加法（`final *= 1 + sum`），MULTIPLY 是独立乘法（累乘）。
   */
  MULTIPLY = 'multiply',
  FINAL = 'final',
  OVERRIDE = 'override',
}

export interface AttributeModifier<TSource = unknown> {
  readonly id: string;
  readonly attrType: AttributeType;
  readonly type: ModifierType;
  readonly value: number;
  readonly source: TSource;
}

// ===== 能力类型 =====
export enum AbilityType {
  ACTIVE_SKILL = 'active_skill',
  PASSIVE_SKILL = 'passive_skill',
  DESTINY = 'destiny',
}

// ===== 效果类型 =====
export enum EffectType {
  DAMAGE = 'damage',
  HEAL = 'heal',
  SHIELD = 'shield',
  ADD_BUFF = 'add_buff',
  REMOVE_BUFF = 'remove_buff',
  STAT_MODIFIER = 'stat_modifier',
}

// ===== 伤害类型 =====
export enum DamageType {
  PHYSICAL = 'physical',
  MAGICAL = 'magical',
  TRUE = 'true',
  DOT = 'dot',
}

// ===== 伤害来源 =====
export enum DamageSource {
  DIRECT = 'direct',
  REFLECT = 'reflect',
  COUNTER = 'counter',
  FOLLOW_UP = 'follow_up',
  DELAYED = 'delayed',
}

/**
 * 数值结果的结构化触发原因。
 * source 表示谁造成结果；cause 表示哪项能力、状态或机制令结果发生。
 */
export interface LogCauseRef {
  kind: 'ability' | 'buff' | 'mechanic';
  id: string;
  displayName: string;
}

export type DamageCalculationMode = 'standard' | 'resolved_final';

export type DamageMitigationMode = 'normal' | 'bypass_defense';

export interface DamageComponent {
  readonly kind: string;
  readonly amount: number;
  readonly mitigation: DamageMitigationMode;
  /** 防御结算前的攻击基数。新伤害段必须同时提供 attackBase 与 segmentMultiplier。 */
  readonly attackBase?: number;
  /** 防御结算后的段倍率。 */
  readonly segmentMultiplier?: number;
}

// ===== BUFF类型 =====
export enum BuffType {
  BUFF = 'buff',
  DEBUFF = 'debuff',
  CONTROL = 'control',
}

// ===== 单元快照 =====
export interface AbilitySnapshot {
  id: string;
  name: string;
  currentCd: number;
  maxCd: number;
  mpCost: number;
  type: AbilityType;
}

export interface UnitSnapshot {
  unitId: UnitId;
  name: string;
  attributes: Record<AttributeType, number>;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  buffs: BuffId[];
  combatResources: Array<{
    id: string;
    name: string;
    icon?: string;
    current: number;
    max: number;
  }>;
  isAlive: boolean;
  hpPercent: number;
  mpPercent: number;
  currentShield: number;
  abilities: AbilitySnapshot[];
  baseAttributes: Record<AttributeType, number>;
}

// 导出事件类型定义
export * from './events';
