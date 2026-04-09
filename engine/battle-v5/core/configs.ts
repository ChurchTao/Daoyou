import { StackRule } from '../buffs/Buff';
import {
  AbilityType,
  AttributeType,
  BuffType,
  DamageType,
  ModifierType,
} from './types';

import { ScalableValue } from './ValueCalculator';

/**
 * 效果执行条件配置
 */
export interface ConditionConfig {
  type:
    | 'has_tag'
    | 'has_not_tag'
    | 'has_tag_on'
    | 'ability_has_tag'
    | 'ability_has_not_tag'
    | 'hp_above'
    | 'hp_below'
    | 'mp_above'
    | 'mp_below'
    | 'buff_count_at_least'
    | 'debuff_count_at_least'
    | 'damage_type_is'
    | 'shield_absorbed_at_least'
    | 'chance';
  params: {
    tag?: string;
    value?: number;
    // 条件作用域，默认 target。
    // hp/mp 条件也可使用该字段在 caster/target 间切换。
    scope?: 'caster' | 'target';
    damageType?: DamageType;
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
  target?: 'hp' | 'mp';
}

/**
 * 施加BUFF参数定义
 */
export interface ApplyBuffParams {
  buffConfig: BuffConfig;
  chance?: number;
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
 * 魔法盾参数定义
 */
export interface MagicShieldParams {
  absorbRatio?: number;
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

export interface BuffDurationModifyParams {
  rounds: number;
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
 * 百分比伤害修正参数（同乘区加算）
 */
export interface PercentDamageModifierParams {
  mode: 'increase' | 'reduce';
  value: number;
  cap?: number;
}

/**
 * 防死参数定义
 */
export type DeathPreventParams = object;

/**
 * BUFF 免疫参数定义
 */
export interface BuffImmunityParams {
  tags: string[];
}

/**
 * 伤害免疫参数定义
 */
export interface DamageImmunityParams {
  tags: string[];
}

/**
 * 重构后的辨识联合类型原子效果配置
 */
export type EffectConfig = BaseEffectConfig &
  (
    | { type: 'damage'; params: DamageParams }
    | { type: 'heal'; params: HealParams }
    | { type: 'apply_buff'; params: ApplyBuffParams }
    | { type: 'resource_drain'; params: ResourceDrainParams }
    | { type: 'dispel'; params: DispelParams }
    | { type: 'shield'; params: ShieldParams }
    | { type: 'magic_shield'; params: MagicShieldParams }
    | { type: 'reflect'; params: ReflectParams }
    | { type: 'mana_burn'; params: ManaBurnParams }
    | { type: 'cooldown_modify'; params: CooldownModifyParams }
    | { type: 'buff_duration_modify'; params: BuffDurationModifyParams }
    | { type: 'tag_trigger'; params: TagTriggerParams }
    | { type: 'percent_damage_modifier'; params: PercentDamageModifierParams }
    | { type: 'death_prevent'; params: DeathPreventParams }
    | { type: 'buff_immunity'; params: BuffImmunityParams }
    | { type: 'damage_immunity'; params: DamageImmunityParams }
  );

// ===== Listener Contract =====

/**
 * 监听器触发范围（owner 与事件参与者的关系）
 */
export type ListenerScope =
  | 'owner_as_target' // 监听器 owner 是事件目标
  | 'owner_as_caster' // 监听器 owner 是事件施法者
  | 'owner_as_actor' // 监听器 owner 是事件参与者（施法者或目标）
  | 'global'; // 监听器不区分参与关系，事件发生时全局触发

/**
 * 上下文映射源
 */
export type ListenerContextSource =
  | 'owner'
  | 'event.caster'
  | 'event.target'
  | 'event.source';

/**
 * 监听器上下文映射
 */
export interface ListenerContextMapping {
  caster: ListenerContextSource;
  target: ListenerContextSource;
}

/**
 * 监听器触发守卫配置
 */
export interface ListenerGuardConfig {
  /**
   * 是否要求 owner 存活（默认 true）
   */
  requireOwnerAlive?: boolean;
  /**
   * 是否允许濒死窗口触发（仅对 DamageTakenEvent 有意义）
   */
  allowLethalWindow?: boolean;
  /**
   * 是否跳过反伤来源（damageSource === 'reflect'）
   */
  skipReflectSource?: boolean;
}

/**
 * 事件监听器配置 (用于 Buff 和被动技能)
 */
export interface ListenerConfig {
  /**
   * 监听器唯一 ID，用于调试与追踪
   */
  id?: string;
  /**
   * 对应 CombatEvent['type']
   * 例如：'RoundPreEvent' | 'DamageTakenEvent' | 'SkillCastEvent'
   */
  eventType: string;
  /**
   * 触发作用域（默认值由事件语义推导）
   */
  scope: ListenerScope;
  /**
   * 订阅优先级（默认值由事件语义推导）
   */
  priority: number;
  /**
   * 上下文映射（默认值由事件语义推导）
   */
  mapping?: ListenerContextMapping;
  /**
   * 执行守卫
   */
  guard?: ListenerGuardConfig;
  /**
   * 触发时执行的效果链
   */
  effects: EffectConfig[];
}

export interface AttributeModifierConfig {
  attrType: AttributeType;
  type: ModifierType;
  value: number;
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
  modifiers?: AttributeModifierConfig[];
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

  /**
   * 被动常驻属性修改器（激活时自动添加，停用时自动清理）
   */
  modifiers?: AttributeModifierConfig[];
}
