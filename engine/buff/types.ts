import type { EffectConfig } from '../effect/types';

// ============================================================
// Buff 配置 (静态配置，策划填表)
// ============================================================

export interface BuffConfig {
  /** Buff 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 最大叠加层数 */
  maxStacks: number;
  /** 默认持续回合数 */
  duration: number;
  /** 叠加策略 */
  stackType: BuffStackType;
  /** 互斥的 Buff ID 列表 */
  conflictsWith?: string[];
  /** Buff 携带的效果列表 */
  effects: EffectConfig[];
  /** Buff 类型标签 (用于分类) */
  tags?: BuffTag[];
  /** 图标路径 (可选) */
  icon?: string;
}

/**
 * Buff 叠加类型
 */
export enum BuffStackType {
  /** 刷新持续时间，不叠加层数 */
  REFRESH = 'refresh',
  /** 叠加层数，刷新持续时间 */
  STACK = 'stack',
  /** 独立存在，每次施加创建新实例 */
  INDEPENDENT = 'independent',
}

/**
 * Buff 类型标签
 */
export enum BuffTag {
  /** 增益 */
  BUFF = 'buff',
  /** 减益 */
  DEBUFF = 'debuff',
  /** 控制 */
  CONTROL = 'control',
  /** 持续伤害 */
  DOT = 'dot',
  /** 持续治疗 */
  HOT = 'hot',
  /** 持久状态 (如伤势) */
  PERSISTENT = 'persistent',
  /** 环境状态 */
  ENVIRONMENTAL = 'environmental',
  /** 可净化 */
  PURGEABLE = 'purgeable',
  /** 不可净化 */
  UNPURGEABLE = 'unpurgeable',
}

// ============================================================
// Buff 实例状态 (运行时数据)
// ============================================================

export interface BuffInstanceState {
  /** 实例唯一 ID */
  instanceId: string;
  /** 配置 ID */
  configId: string;
  /** 当前层数 */
  currentStacks: number;
  /** 剩余回合数 */
  remainingTurns: number;
  /** 施法者 ID (可选，持久状态可能不有施法者) */
  casterId?: string;
  /** 持有者 ID (可选，序列化时可不填) */
  ownerId?: string;
  /** 创建时间 */
  createdAt: number;
  /** 施法者快照 (用于 DOT 伤害计算) */
  casterSnapshot?: CasterSnapshot;
}

/**
 * 施法者快照
 */
export interface CasterSnapshot {
  name: string;
  attributes: Record<string, number>;
  elementMultipliers?: Record<string, number>;
}

// ============================================================
// Buff 事件
// ============================================================

export interface BuffEvent {
  type: BuffEventType;
  buffId: string;
  instanceId?: string;
  ownerId: string;
  casterId?: string;
  stacks?: number;
  remainingTurns?: number;
  message?: string;
}

export enum BuffEventType {
  APPLIED = 'applied',
  REFRESHED = 'refreshed',
  STACKED = 'stacked',
  EXPIRED = 'expired',
  REMOVED = 'removed',
  RESISTED = 'resisted',
}
