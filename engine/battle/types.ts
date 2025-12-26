import type { ElementType, StatusEffect } from '@/types/constants';
import type { Attributes, Cultivator, Skill } from '@/types/cultivator';
import type { ApplyResult } from '@/engine/status/types';

/**
 * 战斗引擎类型定义
 * 用于战斗系统各模块之间的数据交互
 */

// ===== 战斗单元相关 =====

/**
 * 战斗单元ID类型
 */
export type UnitId = 'player' | 'opponent';

/**
 * 初始单元状态
 */
export interface InitialUnitState {
  hp?: number;
  mp?: number;
  persistentStatuses?: Array<{
    statusKey: string;
    potency: number;
    createdAt: number;
    metadata: Record<string, unknown>;
  }>; // 持久状态
  environmentalStatuses?: Array<{
    statusKey: string;
    potency: number;
    createdAt: number;
    metadata: Record<string, unknown>;
  }>; // 环境状态
}

/**
 * 回合单元快照
 */
export interface TurnUnitSnapshot {
  hp: number;
  mp: number;
  statuses: StatusEffect[];
}

/**
 * 回合快照
 */
export interface TurnSnapshot {
  turn: number;
  player: TurnUnitSnapshot;
  opponent: TurnUnitSnapshot;
}

// ===== 战斗结果相关 =====

/**
 * 战斗引擎结果
 */
export interface BattleEngineResult {
  winner: Cultivator;
  loser: Cultivator;
  log: string[];
  turns: number;
  playerHp: number;
  opponentHp: number;
  timeline: TurnSnapshot[];
  // 持久状态快照（战斗后）
  playerPersistentStatuses?: Array<{
    statusKey: string;
    potency: number;
    createdAt: number;
    metadata: Record<string, unknown>;
  }>;
  opponentPersistentStatuses?: Array<{
    statusKey: string;
    potency: number;
    createdAt: number;
    metadata: Record<string, unknown>;
  }>;
}

// ===== 计算器相关 =====

/**
 * 伤害计算结果
 */
export interface DamageResult {
  damage: number;
  isCritical: boolean;
}

/**
 * 伤害计算上下文
 */
export interface DamageContext {
  attacker: {
    attributes: Attributes;
    cultivatorData: Cultivator;
  };
  defender: {
    attributes: Attributes;
    cultivatorData: Cultivator;
    isDefending: boolean;
    hasArmorUp: boolean;
    hasArmorDown: boolean;
  };
  skill: Skill;
}

/**
 * 暴击计算上下文
 */
export interface CriticalContext {
  attributes: Attributes;
  hasCritRateUp: boolean;
  hasCritRateDown: boolean;
}

/**
 * 闪避计算上下文
 */
export interface EvasionContext {
  attributes: Attributes;
  hasSpeedUp: boolean;
  isStunned: boolean;
  isRooted: boolean;
}

/**
 * 属性计算上下文
 */
export interface AttributeContext {
  cultivatorData: Cultivator;
  statusModifications: Partial<Attributes>;
}

// ===== 技能执行相关 =====

/**
 * 技能执行上下文
 */
export interface SkillExecutionContext {
  caster: unknown; // BattleUnit，稍后定义
  target: unknown; // BattleUnit，稍后定义
  skill: Skill;
  log: string[];
}

/**
 * 技能执行结果
 */
export interface SkillExecutionResult {
  success: boolean;
  evaded: boolean;
  damage: number;
  healing: number;
  isCritical: boolean;
  statusApplied: ApplyResult[];
  logs: string[];
}

// ===== 元素相关 =====

/**
 * 元素克制关系
 */
export const ELEMENT_WEAKNESS: Partial<Record<ElementType, ElementType[]>> = {
  金: ['火', '雷'],
  木: ['金', '雷'],
  水: ['土', '风'],
  火: ['水', '冰'],
  土: ['木', '风'],
  风: ['雷', '冰'],
  雷: ['土', '水'],
  冰: ['火', '雷'],
};

// ===== 常量 =====

/**
 * 暴击倍率
 */
export const CRITICAL_MULTIPLIER = 1.8;

/**
 * 最大闪避率
 */
export const MAX_EVASION_RATE = 0.3;

/**
 * 最小暴击率
 */
export const MIN_CRIT_RATE = 0.05;

/**
 * 最大暴击率
 */
export const MAX_CRIT_RATE = 0.6;

/**
 * 最大减伤率
 */
export const MAX_DAMAGE_REDUCTION = 0.7;
