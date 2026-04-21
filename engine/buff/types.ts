/**
 * Buff 类型定义（精简版，迁移到 battle-v5 后不再依赖旧 Effect 体系）
 *
 * 旧的 EffectConfig / BuffTemplate / BuffMaterializer 链路已删除。
 * 以下类型仅用于：
 *   1. 持久状态的序列化（BuffInstanceState，存在 DB JSONB 字段中）
 *   2. UI 展示层根据 configId 查询名称/描述
 */

// ============================================================
// Buff 配置 (仅供 UI 展示用的元数据)
// ============================================================

export interface BuffConfig {
  /** Buff 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述 */
  description?: string;
  /** 最大叠加层数 */
  maxStacks?: number;
  /** Buff 类型标签 (用于分类) */
  tags?: BuffTag[];
  /** 图标路径 (可选) */
  icon?: string;
}

/**
 * Buff 叠加类型
 */
export enum BuffStackType {
  REFRESH = 'refresh',
  STACK = 'stack',
  INDEPENDENT = 'independent',
}

/**
 * Buff 类型标签
 */
export enum BuffTag {
  BUFF = 'buff',
  DEBUFF = 'debuff',
  CONTROL = 'control',
  DOT = 'dot',
  HOT = 'hot',
  PERSISTENT = 'persistent',
  ENVIRONMENTAL = 'environmental',
  PURGEABLE = 'purgeable',
  UNPURGEABLE = 'unpurgeable',
}

// ============================================================
// Buff 实例状态 (运行时数据，用于持久化)
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
  /** 施法者 ID */
  casterId?: string;
  /** 持有者 ID */
  ownerId?: string;
  /** 创建时间 */
  createdAt: number;
  /** 施法者快照 */
  casterSnapshot?: CasterSnapshot;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 施法者快照
 */
export interface CasterSnapshot {
  name: string;
  attributes: Record<string, number>;
  elementMultipliers?: Record<string, number>;
}
