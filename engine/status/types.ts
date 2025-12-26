import type { ElementType, StatusEffect } from '@/types/constants';
import type { Attributes } from '@/types/cultivator';

// ===== 枚举定义 =====

/**
 * 状态类型
 */
export const STATUS_TYPE_VALUES = [
  'buff',
  'debuff',
  'control',
  'dot',
  'persistent',
  'environmental',
] as const;
export type StatusType = (typeof STATUS_TYPE_VALUES)[number];

/**
 * 来源类型
 */
export const SOURCE_TYPE_VALUES = [
  'skill',
  'artifact',
  'consumable',
  'environment',
  'system',
] as const;
export type SourceType = (typeof SOURCE_TYPE_VALUES)[number];

/**
 * 持续时间类型
 */
export const DURATION_TYPE_VALUES = [
  'turn',
  'realtime',
  'permanent',
  'conditional',
] as const;
export type DurationType = (typeof DURATION_TYPE_VALUES)[number];

/**
 * 条件类型
 */
export const CONDITION_TYPE_VALUES = [
  'combat_end',
  'heal_above',
  'dispel',
  'time_expired',
  'custom',
] as const;
export type ConditionType = (typeof CONDITION_TYPE_VALUES)[number];

// ===== 核心数据结构 =====

/**
 * 施放者快照 - 用于DOT等需要记录施放者属性的状态
 */
export interface CasterSnapshot {
  casterId: string;
  casterName: string;
  attributes: Attributes;
  elementMultipliers?: Partial<Record<ElementType, number>>;
}

/**
 * 状态来源
 */
export interface StatusSource {
  sourceType: SourceType;
  sourceId?: string;
  sourceName: string;
  casterSnapshot?: CasterSnapshot;
}

/**
 * 状态消退条件
 */
export interface StatusCondition {
  conditionType: ConditionType;
  conditionValue?: unknown;
}

/**
 * 状态持续时间
 */
export interface StatusDuration {
  durationType: DurationType;
  remaining: number;
  total: number;
  tickInterval?: number;
  condition?: StatusCondition;
}

/**
 * 状态实例
 */
export interface StatusInstance {
  statusId: string;
  statusType: StatusType;
  statusKey: StatusEffect;
  displayName: string;
  description?: string;
  source: StatusSource;
  duration: StatusDuration;
  potency: number;
  stackable: boolean;
  maxStack: number;
  currentStack: number;
  element?: ElementType;
  metadata: Record<string, unknown>;
  createdAt: number;
}

/**
 * 状态定义 - 用于StatusRegistry
 */
export interface StatusDefinition {
  statusKey: StatusEffect;
  statusType: StatusType;
  displayName: string;
  description?: string;
  defaultDuration: StatusDuration;
  defaultPotency: number;
  stackable: boolean;
  maxStack: number;
  element?: ElementType;
  conflictsWith?: StatusEffect[];
}

// ===== 状态应用相关 =====

/**
 * 状态应用请求
 */
export interface StatusApplicationRequest {
  statusKey: StatusEffect;
  source: StatusSource;
  durationOverride?: Partial<StatusDuration>;
  potency?: number;
  stackToAdd?: number;
  element?: ElementType;
  metadata?: Record<string, unknown>;
}

/**
 * 状态应用结果
 */
export interface ApplyResult {
  success: boolean;
  statusId?: string;
  resistedByWillpower?: boolean;
  conflictedWith?: StatusEffect;
  message: string;
}

// ===== 状态刷新相关 =====

/**
 * 单位快照 - 用于状态刷新时获取目标信息
 */
export interface UnitSnapshot {
  unitId: string;
  currentHp: number;
  currentMp: number;
  maxHp: number;
  maxMp: number;
  baseAttributes: Attributes;
}

/**
 * 战斗上下文 - 可选,提供额外的战斗信息
 */
export interface BattleContext {
  battleId?: string;
  turnNumber: number;
  isPlayerTurn: boolean;
}

/**
 * 状态刷新上下文
 */
export interface TickContext {
  currentTurn: number;
  currentTime: number;
  unitSnapshot: UnitSnapshot;
  unitName: string; // 单位名称，用于生成日志
  battleContext?: BattleContext;
}

/**
 * 状态刷新结果
 */
export interface TickResult {
  damageDealt: number;
  healingDone: number;
  expiredStatuses: string[];
  effectLogs: string[];
}

// ===== 效果计算相关 =====

/**
 * 计算上下文 - 传递给效果计算器
 */
export interface CalculationContext {
  target: UnitSnapshot;
  caster?: CasterSnapshot;
  battleContext?: BattleContext;
  currentTime?: number;
}

/**
 * 属性修正结果
 */
export interface AttributeModification {
  vitality: number;
  spirit: number;
  wisdom: number;
  speed: number;
  willpower: number;
  maxHp?: number; // 最大气血修正
  maxMp?: number; // 最大灵力修正
  healingEffectiveness?: number; // 治疗效果修正(百分比,-30表示-30%)
  elementDamageMultiplier?: Partial<Record<ElementType, number>>; // 元素伤害倍率修正
  mpRecoveryMultiplier?: number; // 灵力恢复倍率修正(百分比)
}

/**
 * 行动限制结果
 */
export interface ActionBlockResult {
  canAct: boolean;
  canUseSkill: boolean;
  canDodge: boolean;
  blockReasons: string[];
}

/**
 * 效果计算器接口
 */
export interface EffectCalculator {
  /**
   * 计算属性修正(可选)
   */
  calculateAttributeModification?(
    status: StatusInstance,
    context: CalculationContext,
  ): Partial<AttributeModification>;

  /**
   * 计算持续伤害(可选)
   */
  calculateDamageOverTime?(
    status: StatusInstance,
    context: CalculationContext,
  ): number;

  /**
   * 检查行动限制(可选)
   */
  checkActionBlock?(
    status: StatusInstance,
    context: CalculationContext,
  ): Partial<ActionBlockResult>;

  /**
   * 计算抵抗率(可选)
   */
  calculateResistance?(
    attackerWillpower: number,
    defenderWillpower: number,
    statusPotency: number,
  ): number;
}
