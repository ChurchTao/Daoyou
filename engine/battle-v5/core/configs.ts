import { StackRule } from '../buffs/Buff';
import { AbilityType, AttributeType, BuffType, ModifierType } from './types';

import { ScalableValue } from './ValueCalculator';

/**
 * 效果执行条件配置
 */
export interface ConditionConfig {
  type: 'has_tag' | 'has_not_tag' | 'hp_above' | 'hp_below' | 'chance';
  params: {
    tag?: string;
    value?: number;
  };
}

/**
 * 原子效果基础配置
 */
export interface BaseEffectConfig {
  conditions?: ConditionConfig[];
}

/**
 * 各类 GE 参数定义 (辨识联合类型的基础)
 */

/**
 * 伤害参数定义
 */
export interface DamageParams {
  value: ScalableValue;
}

/**
 * 治疗参数定义
 */
export interface HealParams {
  value: ScalableValue;
}

/**
 * 施加BUFF参数定义
 */
export interface ApplyBuffParams {
  buffConfig: BuffConfig;
  chance?: number;
}

/**
 * 属性修改参数定义
 */
export interface AttributeModParams {
  attrType: AttributeType;
  modType: ModifierType;
  value: number;
  isPermanent?: boolean;
}

/**
 * 资源消耗参数定义
 */
export interface ResourceDrainParams {
  sourceType: 'hp' | 'mp';
  targetType: 'hp' | 'mp';
  ratio: number;
}

/**
 * 解除DEBUFF参数定义
 */
export interface DispelParams {
  targetTag?: string;
  maxCount?: number;
}

/**
 * 屏蔽参数定义
 */
export interface ShieldParams {
  value: ScalableValue;
}

/**
 * 反射参数定义
 */
export interface ReflectParams {
  ratio: number;
}

/**
 * 灵魂之burn参数定义
 */
export interface ManaBurnParams {
  value: ScalableValue;
}

/**
 * 冷却修改参数定义
 */
export interface CooldownModifyParams {
  cdModifyValue: number;
  tags?: string[];
}

/**
 * 标签触发参数定义
 */
export interface TagTriggerParams {
  triggerTag: string;
  damageRatio?: number;
  removeOnTrigger?: boolean;
}

/**
 * 防死参数定义
 */
export type DeathPreventParams = object;

/**
 * 重构后的辨识联合类型原子效果配置
 */
export type EffectConfig = BaseEffectConfig &
  (
    | { type: 'damage'; params: DamageParams }
    | { type: 'heal'; params: HealParams }
    | { type: 'apply_buff'; params: ApplyBuffParams }
    | { type: 'attribute_mod'; params: AttributeModParams }
    | { type: 'resource_drain'; params: ResourceDrainParams }
    | { type: 'dispel'; params: DispelParams }
    | { type: 'shield'; params: ShieldParams }
    | { type: 'reflect'; params: ReflectParams }
    | { type: 'mana_burn'; params: ManaBurnParams }
    | { type: 'cooldown_modify'; params: CooldownModifyParams }
    | { type: 'tag_trigger'; params: TagTriggerParams }
    | { type: 'death_prevent'; params: DeathPreventParams }
  );

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
