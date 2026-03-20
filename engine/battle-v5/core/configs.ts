import { StackRule } from '../buffs/Buff';
import { AbilityType, AttributeType, BuffType, ModifierType } from './types';

/**
 * 原子效果配置
 */
export interface EffectConfig {
  type: 'damage' | 'heal' | 'apply_buff' | 'attribute_mod' | 'hit_check';
  params: {
    // 伤害/治疗参数
    attribute?: AttributeType;
    coefficient?: number;
    baseValue?: number;

    // 添加 Buff 参数
    chance?: number;
    buffConfig?: BuffConfig;

    // 属性修改参数 (Buff 内部使用)
    attrType?: AttributeType;
    modType?: ModifierType;
    value?: number;
  };
}

/**
 * 事件监听器配置 (用于 Buff 和被动技能)
 */
export interface ListenerConfig {
  /**
   * 对应 CombatEvent['type']
   * 例如：'RoundPreEvent' | 'DamageTakenEvent' | 'SkillCastEvent'
   */
  eventType: string;
  /**
   * 触发时执行的效果链
   */
  effects: EffectConfig[];
}

/**
 * BUFF 配置 (完全自包含)
 */
export interface BuffConfig {
  id: string;
  name: string;
  type: BuffType;
  duration: number; // -1 为永久
  stackRule: StackRule;
  tags?: string[]; // Buff 自身的标签
  statusTags?: string[]; // 附加给宿主的标签
  /**
   * 基础属性修改器链 (激活时自动添加，移除时自动清理)
   */
  modifiers?: Array<{
    attrType: AttributeType;
    type: ModifierType;
    value: number;
  }>;
  /**
   * 逻辑监听链 (EDA 核心)
   */
  listeners?: ListenerConfig[];
}

/**
 * 技能配置 (完全自包含)
 */
export interface AbilityConfig {
  slug: string;
  name: string;
  type: AbilityType;
  tags?: string[];

  // 资源与消耗
  mpCost?: number;
  hpCost?: number;
  cooldown?: number;
  priority?: number;

  // 目标策略
  targetPolicy?: {
    team: 'enemy' | 'ally' | 'self' | 'any';
    scope: 'single' | 'aoe' | 'random';
    maxTargets?: number;
  };

  /**
   * 主动效果链 (主动技能执行时触发)
   */
  effects?: EffectConfig[];

  /**
   * 被动监听链 (被动技能专用)
   */
  listeners?: ListenerConfig[];
}
