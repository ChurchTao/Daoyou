import { StackRule } from '../buffs/Buff';
import {
  AbilityType,
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  ModifierType,
} from './types';

import { ScalableValue } from './ValueCalculator';

export type AbilitySelectionIntent =
  'damage' | 'heal_hp' | 'restore_mp' | 'control' | 'buff' | 'defensive';

export interface AbilitySelectionProfile {
  intents?: AbilitySelectionIntent[];
  rules?: AbilitySelectionRule[];
}

export interface AbilitySelectionRule {
  conditions: ConditionConfig[];
  scoreDelta?: number;
  disqualify?: boolean;
}

export type AbilityCostConfig =
  | { resource: 'mp' | 'hp'; mode: 'flat'; amount: number; retain?: number }
  | {
      resource: 'hp';
      mode: 'current_hp_ratio' | 'current_percent';
      ratio: number;
      minimum?: number;
      retain?: number;
    };

export interface AbilityVariantConfig {
  id: string;
  name: string;
  description?: string;
  priority: number;
  conditions: ConditionConfig[];
  costs?: AbilityCostConfig[];
  targetPolicy?: AbilityConfig['targetPolicy'];
  selectionProfile?: AbilitySelectionProfile;
  castConditions?: ConditionConfig[];
  effects?: EffectConfig[];
  castEffects?: EffectConfig[];
}

export interface CombatResourceDefinition {
  id: string;
  name: string;
  /** 战斗状态栏使用的点阵图标；缺失时沿用进度条展示。 */
  icon?: string;
  initial: number;
  max: number;
  decayOnNoDirectDamage?: number;
  /** 每连续多少次未造成直接伤害的行动触发一次衰减，默认 1。 */
  noDirectDamageActionsPerDecay?: number;
  decayOnControlledSkip?: number;
  pauseDecayWhileShielded?: boolean;
  pauseDecayWhenCounterAtLeast?: {
    key: string;
    value: number;
  };
}

/**
 * 效果执行条件配置
 */
export interface ConditionConfig {
  type:
    | 'has_tag'
    | 'has_not_tag'
    | 'has_tag_on'
    | 'ability_has_tag'
    | 'ability_has_exact_tag'
    | 'ability_has_not_tag'
    | 'hp_above'
    | 'hp_below'
    | 'mp_above'
    | 'mp_below'
    | 'ability_mp_cost_at_least'
    | 'has_shield'
    | 'buff_count_at_least'
    | 'buff_layer_at_least'
    | 'buff_layer_below'
    | 'debuff_count_at_least'
    | 'damage_type_is'
    | 'damage_source_is'
    | 'shield_absorbed_at_least'
    | 'resource_compare'
    | 'attribute_compare'
    | 'combat_resource_at_least'
    | 'combat_resource_below'
    | 'runtime_counter_compare'
    | 'ability_mode_is'
    | 'ability_mode_ability_differs'
    | 'ability_variant_is'
    | 'ability_cost_crossed'
    | 'combat_resource_change'
    | 'chance'
    | 'is_critical'
    | 'is_hit'
    | 'is_lethal';
  params: {
    tag?: string;
    id?: string;
    value?: number;
    // 条件作用域，默认 target。
    // hp/mp 条件也可使用该字段在 caster/target 间切换。
    scope?: 'caster' | 'target';
    resource?: 'hp' | 'mp';
    attribute?: AttributeType;
    left?: 'caster' | 'target';
    op?: 'gt' | 'gte' | 'lt' | 'lte';
    right?: 'caster' | 'target';
    damageType?: DamageType;
    damageSource?: `${DamageSource}`;
    resourceId?: string;
    key?: string;
    mode?: string;
    phase?: number;
    variantId?: string;
    timing?: 'live' | 'cast';
    operation?: 'add' | 'subtract' | 'set' | 'consume_all';
    eventField?: 'requested' | 'applied' | 'overflow';
  };
}

/**
 * 原子效果基础配置
 */
export interface BaseEffectConfig {
  conditions?: ConditionConfig[];
  globalUnique?: GlobalUniqueConfig;
}

/**
 * 各类 GE 参数定义 (辨识联合类型的基础)
 */

/**
 * 伤害参数定义
 */
export interface DamageParams {
  value: ScalableValue;
  damageType?: DamageType;
  bypassDefense?: boolean;
  damageSource?: DamageSource;
  forceCritical?: boolean;
  forceCriticalConditions?: ConditionConfig[];
  dynamicScalars?: DamageDynamicScalarConfig[];
}

export interface DamageDynamicScalarConfig {
  source: 'target_missing_hp_ratio';
  attribute: AttributeType;
  coefficientCap: number;
  timing?: 'live' | 'cast';
}

/**
 * 治疗参数定义
 */
export interface HealParams {
  value: ScalableValue;
  target?: 'hp' | 'mp';
  recipient?: 'caster' | 'target';
}

/**
 * 施加BUFF参数定义
 */
export interface ApplyBuffParams {
  buffConfig: BuffConfig;
  chance?: number;
  target?: 'caster' | 'target';
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
  target?: 'caster' | 'target';
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
  ratioPerLayer?: number;
  layerBuffId?: string;
  maxHpRatioPerAction?: number;
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
  maxCount?: number;
  target?: 'caster' | 'target';
  includeCurrent?: boolean;
}

export interface SkipActionParams {
  count?: number;
  reason: string;
  name?: string;
}

export interface QueueActionParams {
  id: string;
  name: string;
  effects: EffectConfig[];
  tags: string[];
  targetPolicy?: AbilityConfig['targetPolicy'];
  interruptPolicy?: 'normal' | 'uninterruptible';
  hitPolicy?: 'normal' | 'guaranteed';
  cancelEffects?: EffectConfig[];
}

export interface ResourceScaledDamageParams {
  resourceId: string;
  baseCoefficient: number;
  coefficientPerPoint: number;
  minPoints?: number;
  maxPoints?: number;
  consume?: 'all' | number;
  attribute?: AttributeType;
  damageType?: DamageType;
  bypassDefenseRatio?: number;
  damageSource?: DamageSource;
  forceCritical?: boolean;
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
  displayName?: string;
  damageRatio?: number;
  removeOnTrigger?: boolean;
  effects?: EffectConfig[];
}

export interface BuffMatchParams {
  id?: string;
  tags?: string[];
}

export interface ConsumeStatusTriggerParams {
  match: BuffMatchParams;
  /** 玩家可见的状态名称；展示层不得从内部ID推断。 */
  displayName?: string;
  consume?: 'one' | 'all' | number;
  effects: EffectConfig[];
  scaleEffectsByLayer?: boolean;
  /** 按实际消费层数缩放数值强度，次数、目标数和状态操作仍只执行一次。 */
  scaleNumericEffectsByLayer?: boolean;
  target?: 'caster' | 'target';
}

export interface DelayedEffectParams {
  id: string;
  name: string;
  description?: string;
  delayTurns: number;
  effects: EffectConfig[];
  tags?: string[];
  statusTags?: string[];
  record?: {
    key: string;
    event: 'damage_taken' | 'heal' | 'shield' | 'shield_break';
    maxStored?: number;
    maxStoredValue?: ScalableValue;
  };
  triggerOnDispel?: boolean;
  maxTriggers?: number;
}

export interface DamageMemoryParams {
  key: string;
  mode: 'record' | 'release' | 'clear';
  event?:
    | 'damage_taken'
    | 'damage_dealt'
    | 'heal'
    | 'shield'
    | 'critical_taken'
    | 'shield_break'
    | 'shield_absorbed'
    | 'ability_cost_paid';
  ratio?: number;
  releaseAs?:
    'damage' | 'heal' | 'shield' | 'reflect' | 'counter' | 'follow_up';
  target?: 'caster' | 'target';
  maxStored?: number;
  maxStoredValue?: ScalableValue;
  includeShieldAbsorbed?: boolean;
  consume?: boolean;
  /** 释放后仅消费这部分记忆；1为全部，0.5为保留一半。 */
  consumeRatio?: number;
  /** 单次释放的最终记忆量上限。 */
  maxReleaseValue?: ScalableValue;
}

export interface BuffLayerModifyParams {
  match: BuffMatchParams;
  operation: 'add' | 'subtract' | 'clear' | 'set';
  layers?: number;
  effects?: EffectConfig[];
  scaleEffectsByLayer?: boolean;
  target?: 'caster' | 'target';
}

export interface CombatResourceModifyParams {
  resourceId: string;
  operation: 'add' | 'subtract' | 'set' | 'consume_all';
  amount?: number;
  target?: 'caster' | 'target';
  effects?: EffectConfig[];
  scaleEffectsByAmount?: boolean;
  reason?: 'gain' | 'spend' | 'refund';
}

export interface AbilityTransformParams {
  id: string;
  triggers?: number;
  appliesToTags?: string[];
  trueDamage?: boolean;
  addDispel?: DispelParams;
  mpCostToHp?: boolean;
  freeManaCost?: boolean;
  cooldownModify?: number;
  forceCritical?: boolean;
  bonusDamageMemory?: {
    key: string;
    ratio?: number;
    consume?: boolean;
  };
}

export interface HpSacrificeDamageParams {
  hpRatio: number;
  damagePerHp: number;
  minHpFloor?: number;
}

export interface AbilityLockParams {
  rounds: number;
  tags?: string[];
  maxCount?: number;
}

export interface StatusSpreadParams {
  match: BuffMatchParams;
  maxCount?: number;
}

export interface BuffCopyParams {
  id?: string;
  match?: BuffMatchParams;
  target?: 'caster' | 'target';
  durationDelta?: number;
  replayRemoved?: boolean;
  maxTriggers?: number;
}

export interface DamageDeferParams {
  ratio: number;
  delayTurns: number;
  thresholdMaxHpRatio?: number;
  memory?: {
    key: string;
    maxStoredValue?: ScalableValue;
  };
}

export interface NextHitRuleParams {
  forceCritical?: boolean;
  triggers?: number;
  appliesToTags?: string[];
}

export interface DynamicScalarParams {
  mode: 'increase' | 'reduce';
  value: number;
  resource: 'hp' | 'mp';
  lowerIsStronger?: boolean;
  cap?: number;
}

export interface TurnStateCounterParams {
  key: string;
  event: 'no_damage_dealt' | 'damage_dealt';
  threshold: number;
  effects: EffectConfig[];
  resetOnTrigger?: boolean;
}

export interface RuntimeCounterModifyParams {
  key: string;
  operation: 'add' | 'subtract' | 'set' | 'reset';
  amount?: number;
  amountFromEvent?: 'requested' | 'applied' | 'overflow';
  target?: 'caster' | 'target';
  min?: number;
  max?: number;
  effects?: EffectConfig[];
  scaleEffectsByAmount?: boolean;
}

export interface ElementHistoryParams {
  key: string;
  threshold: number;
  effects: EffectConfig[];
  resetOnTrigger?: boolean;
}

export interface EffectSequenceParams {
  effects: EffectConfig[];
}

export interface AbilityModeParams {
  key: string;
  operation: 'set' | 'advance' | 'clear';
  mode?: string;
  phase?: number;
  remainingUses?: number;
  displayName?: string;
  /** 形态清除时一并移除的状态。 */
  cleanupBuffIds?: string[];
}

export interface StatusTransferParams {
  operation: 'move' | 'remove';
  from: 'caster' | 'target';
  to?: 'caster' | 'target';
  status: 'positive' | 'negative';
  maxCount?: number;
  effects?: EffectConfig[];
  fallbackEffects?: EffectConfig[];
}

export interface LifestealParams {
  ratio: number;
  maxHpRatioPerAction: number;
  variantIds?: string[];
}

export interface DamageCapParams {
  maxHpRatio: number;
  deferOverflowTurns?: number;
}

/**
 * 百分比伤害修正参数（同乘区加算）
 */
export interface PercentDamageModifierParams {
  mode: 'increase' | 'reduce';
  value: number;
  cap?: number;
  /** 按产生监听器的 Buff 当前层数放大数值。 */
  scaleByBuffLayer?: boolean;
  allowedDamageSources?: DamageSource[];
  excludedDamageTypes?: DamageType[];
}

/**
 * 防死参数定义
 */
export interface DeathPreventParams {
  /** 触发后保留的气血值百分比，不传则=1点 */
  hpFloorPercent?: number;
  /** 免死触发记账 key；不传时由运行时来源推导 */
  triggerKey?: string;
}

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
    | { type: 'consume_status_trigger'; params: ConsumeStatusTriggerParams }
    | { type: 'delayed_effect'; params: DelayedEffectParams }
    | { type: 'damage_memory'; params: DamageMemoryParams }
    | { type: 'buff_layer_modify'; params: BuffLayerModifyParams }
    | { type: 'combat_resource_modify'; params: CombatResourceModifyParams }
    | { type: 'ability_transform'; params: AbilityTransformParams }
    | { type: 'hp_sacrifice_damage'; params: HpSacrificeDamageParams }
    | { type: 'ability_lock'; params: AbilityLockParams }
    | { type: 'status_spread'; params: StatusSpreadParams }
    | { type: 'buff_copy'; params: BuffCopyParams }
    | { type: 'damage_defer'; params: DamageDeferParams }
    | { type: 'next_hit_rule'; params: NextHitRuleParams }
    | { type: 'dynamic_scalar'; params: DynamicScalarParams }
    | { type: 'turn_state_counter'; params: TurnStateCounterParams }
    | { type: 'runtime_counter_modify'; params: RuntimeCounterModifyParams }
    | { type: 'element_history'; params: ElementHistoryParams }
    | { type: 'effect_sequence'; params: EffectSequenceParams }
    | { type: 'ability_mode'; params: AbilityModeParams }
    | { type: 'status_transfer'; params: StatusTransferParams }
    | { type: 'lifesteal'; params: LifestealParams }
    | { type: 'damage_cap'; params: DamageCapParams }
    | { type: 'percent_damage_modifier'; params: PercentDamageModifierParams }
    | { type: 'death_prevent'; params: DeathPreventParams }
    | { type: 'buff_immunity'; params: BuffImmunityParams }
    | { type: 'damage_immunity'; params: DamageImmunityParams }
    | { type: 'skip_action'; params: SkipActionParams }
    | { type: 'queue_action'; params: QueueActionParams }
    | { type: 'resource_scaled_damage'; params: ResourceScaledDamageParams }
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
  'owner' | 'event.caster' | 'event.target' | 'event.source';

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
  /** 跳过反伤、反击和追击等二次伤害，避免响应链递归。 */
  skipSecondaryDamageSource?: boolean;
}

export interface ListenerTriggerBudgetConfig {
  maxTriggers: number;
  reset: 'buff_lifetime' | 'action' | 'source_action' | 'round' | 'battle';
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
  /** 限制监听器在指定生命周期窗口内的触发次数。 */
  budget?: ListenerTriggerBudgetConfig;
  /** 在消费触发预算前判定的事件条件。 */
  conditions?: ConditionConfig[];
  /**
   * 触发时执行的效果链
   */
  effects: EffectConfig[];
}

export interface GlobalUniqueConfig {
  key: string;
  label?: string;
}

export interface AttributeModifierConfig {
  attrType: AttributeType;
  type: ModifierType;
  value: number;
  /** 按 Buff 当前层数放大属性修改值。 */
  scaleByLayer?: boolean;
}

/**
 * BUFF 配置 (完全自包含)
 */
export interface BuffConfig {
  id: string;
  name: string;
  description?: string;
  type: BuffType;
  duration: number; // -1 为永久
  /** 内部计数/防重复 marker 可仅保留在调试日志。 */
  logVisibility?: 'player' | 'debug';
  stackRule: StackRule;
  maxLayers?: number;
  /** 默认状态可被驱散、转移；protected 状态只能由自身机制移除。 */
  dispelPolicy?: 'normal' | 'protected';
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
  description?: string;
  type: AbilityType;
  tags?: string[];

  // 资源与消耗
  mpCost?: number;
  hpCost?: number;
  costs?: AbilityCostConfig[];
  cooldown?: number;
  priority?: number;

  // 目标策略
  targetPolicy?: {
    team: 'enemy' | 'ally' | 'self' | 'any';
    scope: 'single' | 'aoe' | 'random';
    maxTargets?: number;
  };

  selectionProfile?: AbilitySelectionProfile;
  castConditions?: ConditionConfig[];

  /** 按运行时状态选取的完整技能形态；高 priority 优先。 */
  variants?: AbilityVariantConfig[];

  /**
   * 主动效果链 (主动技能执行时触发)
   */
  effects?: EffectConfig[];

  /** 消耗和冷却结算后必定执行，不受本次命中判定影响。 */
  castEffects?: EffectConfig[];

  /**
   * 被动监听链 (被动技能专用)
   */
  listeners?: ListenerConfig[];

  /**
   * 被动常驻属性修改器（激活时自动添加，停用时自动清理）
   */
  modifiers?: AttributeModifierConfig[];
}
