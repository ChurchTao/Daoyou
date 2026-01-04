import type { BuffInstanceState } from '@/engine/buff/types';
import type { ElementType } from '@/types/constants';
import type { Attributes, Cultivator, Skill } from '@/types/cultivator';

/**
 * 战斗引擎类型定义
 * 简化版：删除旧格式兼容类型
 */

// ===== 战斗单元相关 =====

/**
 * 战斗单元 ID 类型
 */
export type UnitId = 'player' | 'opponent';

/**
 * 初始单元状态（新格式）
 */
export interface InitialUnitState {
  /** HP 损失百分比 (0-1) */
  hpLossPercent?: number;
  /** MP 损失百分比 (0-1) */
  mpLossPercent?: number;
  /** 持久 Buff 状态 */
  persistentBuffs?: BuffInstanceState[];
}

/**
 * 回合单元快照
 */
export interface TurnUnitSnapshot {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  buffs: string[]; // Buff ID 列表
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
  player: string;
  opponent: string;
  /** 玩家持久 Buff */
  playerPersistentBuffs?: BuffInstanceState[];
  /** 对手持久 Buff */
  opponentPersistentBuffs?: BuffInstanceState[];
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
 * 伤害计算上下文（供 EffectEngine 使用）
 */
export interface DamageContext {
  /** 攻击者 */
  attacker: {
    attributes: Attributes;
    cultivatorData: Cultivator;
  };
  /** 防御者 */
  defender: {
    attributes: Attributes;
    cultivatorData: Cultivator;
    isDefending: boolean;
  };
  /** 技能 */
  skill: Skill;
}

/**
 * 暴击计算上下文
 */
export interface CriticalContext {
  attributes: Attributes;
  critRateBonus?: number; // Buff 提供的暴击率加成
}

/**
 * 闪避计算上下文
 */
export interface EvasionContext {
  attributes: Attributes;
  speedBonus?: number; // Buff 提供的速度加成
  cannotDodge?: boolean; // 是否被定身等无法闪避
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

/** 暴击倍率 */
export const CRITICAL_MULTIPLIER = 1.8;

/** 最大闪避率 */
export const MAX_EVASION_RATE = 0.3;

/** 最小暴击率 */
export const MIN_CRIT_RATE = 0.05;

/** 最大暴击率 */
export const MAX_CRIT_RATE = 0.6;

/** 最大减伤率 */
export const MAX_DAMAGE_REDUCTION = 0.7;
