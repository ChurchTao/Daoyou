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

/**
 * Buff 结算时机
 */
export enum TickMoment {
  /** 持有者行动开始时结算 (控制类 Buff 推荐) */
  ON_ACTION_START = 'on_action_start',
  /** 持有者行动结束时结算 (增益/减益类 Buff 推荐) */
  ON_ACTION_END = 'on_action_end',
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

// ============================================================
// Buff 模板系统 (支持动态数值)
// ============================================================

import type { Quality, RealmType, SkillGrade } from '@/types/constants';
import type { EffectTrigger, EffectType } from '../effect/types';

/**
 * 可缩放数值
 * 用于表示需要根据施法者属性/品质/境界动态计算的数值
 */
export interface BuffScalableValue {
  /** 基础值 */
  base: number;
  /** 缩放类型 */
  scale:
    | 'caster_spirit' // 基于施法者灵力
    | 'caster_wisdom' // 基于施法者悟性
    | 'caster_willpower' // 基于施法者神识
    | 'caster_vitality' // 基于施法者体魄
    | 'quality' // 基于物品/技能品质
    | 'realm' // 基于施法者境界
    | 'stacks' // 基于当前层数
    | 'none'; // 不缩放
  /** 缩放系数 (默认 1) */
  coefficient?: number;
}

/**
 * Buff 效果模板
 * 与 AffixWeight 类似，使用 BuffScalableValue 表示动态数值
 */
export interface BuffEffectTemplate {
  /** 效果类型 */
  type: EffectType;
  /** 触发时机 */
  trigger?: EffectTrigger | string;
  /** 参数模板 (固定值或 BuffScalableValue) */
  paramsTemplate: Record<string, unknown>;
}

/**
 * Buff 模板配置
 * 支持动态数值，替代固定数值的 BuffConfig
 */
export interface BuffTemplate {
  /** Buff 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 描述模板 (支持 {damage} 等占位符) */
  descriptionTemplate?: string;
  /** 最大叠加层数 */
  maxStacks: number;
  /** 默认持续回合数 */
  duration: number;
  /** 叠加策略 */
  stackType: BuffStackType;
  /** 互斥的 Buff ID 列表 */
  conflictsWith?: string[];
  /** 效果模板列表 */
  effectTemplates: BuffEffectTemplate[];
  /** Buff 类型标签 */
  tags?: BuffTag[];
  /** 图标路径 */
  icon?: string;
}

/**
 * Buff 数值化上下文
 * 提供计算动态数值所需的信息
 */
export interface BuffMaterializationContext {
  /** 施法者灵力 */
  casterSpirit?: number;
  /** 施法者悟性 */
  casterWisdom?: number;
  /** 施法者神识 */
  casterWillpower?: number;
  /** 施法者体魄 */
  casterVitality?: number;
  /** 施法者境界 */
  casterRealm?: RealmType;
  /** 物品/技能品质 */
  quality?: Quality;
  /** 技能品阶 */
  skillGrade?: SkillGrade;
  /** Buff 层数 (用于层数相关的数值计算) */
  stacks?: number;
}

/**
 * Buff 参数覆盖
 * 用于 AddBuff 效果传递自定义参数，覆盖模板中的默认值
 */
export interface BuffParamsOverride {
  /** 效果索引到参数覆盖的映射 */
  [effectIndex: number]: Record<string, number | BuffScalableValue>;
}
