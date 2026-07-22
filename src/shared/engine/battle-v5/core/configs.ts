import { StackRule } from '../buffs/Buff';
import {
  AbilityType,
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  type LogCauseRef,
  type MechanicTriggerBasisRef,
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
  | {
      resource: 'mp' | 'hp';
      mode: 'flat';
      amount: number;
      retain?: number;
      conditions?: ConditionConfig[];
    }
  | {
      resource: 'hp';
      mode: 'current_hp_ratio' | 'current_percent';
      ratio: number;
      minimum?: number;
      retain?: number;
      conditions?: ConditionConfig[];
    };

/**
 * 技能的追加效果层。基础 effects/completionEffects 为 A，计划只能按 ID 追加层。
 */
export interface AbilityEffectLayerConfig {
  id: string;
  effects?: EffectConfig[];
  completionEffects?: EffectConfig[];
}

/**
 * 受限的运行时效果计划：只改变展示与启用层，不得覆盖目标、费用或 AI 意图。
 */
export interface AbilityEffectPlanConfig {
  id: string;
  name: string;
  description?: string;
  priority: number;
  conditions: ConditionConfig[];
  layerIds: string[];
  consumeModeKey?: string;
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
    | 'source_has_tag'
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
    remainingUses?: number;
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
  /** 仅令指定比例的伤害分量绕过防御，0～1。 */
  bypassDefenseRatio?: number;
  damageSource?: DamageSource;
  cause?: LogCauseRef;
  forceCritical?: boolean;
  forceCriticalConditions?: ConditionConfig[];
  dynamicScalars?: DamageDynamicScalarConfig[];
}

export interface DamageDynamicScalarConfig {
  source: 'target_missing_hp_ratio';
  attribute: AttributeType;
  coefficientCap: number;
  /** 目标已损气血比例严格高于该阈值后才启用；缺省不设阈值。 */
  minMissingHpRatio?: number;
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
  /** 仅参与本次控制抗性判定，不修改施法者的全局控制命中。 */
  controlHitBonus?: number;
  /** 仅在控制抗性判定抵抗时执行；Buff 免疫不会触发。 */
  onResistEffects?: EffectConfig[];
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
  /** 缺省为 target；用于自净化而不改变技能目标策略。 */
  recipient?: 'caster' | 'target';
  /** 缺省不区分；positive=增益，negative=减益或控制。 */
  status?: 'positive' | 'negative';
  /** 至少成功移除一个状态后执行一次。 */
  effects?: EffectConfig[];
  /** 没有合法状态可移除时执行一次。 */
  fallbackEffects?: EffectConfig[];
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
  /** 状态不存在时执行一次；用于显式降级，不改变消费语义。 */
  fallbackEffects?: EffectConfig[];
  scaleEffectsByLayer?: boolean;
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
    | 'shield_absorbed';
  ratio?: number;
  releaseAs?:
    'damage' | 'heal' | 'shield' | 'reflect' | 'counter' | 'follow_up' | 'resolved_follow_up';
  damageType?: DamageType;
  damageTags?: string[];
  cause?: LogCauseRef;
  target?: 'caster' | 'target';
  maxStored?: number;
  maxStoredValue?: ScalableValue;
  includeShieldAbsorbed?: boolean;
  consume?: boolean;
}

export interface BuffLayerModifyParams {
  match: BuffMatchParams;
  operation: 'add' | 'subtract' | 'clear' | 'set';
  layers?: number;
  effects?: EffectConfig[];
  scaleEffectsByLayer?: boolean;
  target?: 'caster' | 'target';
  logVisibility?: 'player' | 'debug';
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

export interface RefundPaidCostParams {
  ratio: number;
  resource?: 'mp';
}

export interface BuffPeriodicSettlementParams {
  match: BuffMatchParams;
  mode: 'once_keep_duration' | 'remaining_remove';
  target?: 'caster' | 'target';
  source?: 'caster' | 'any';
  cause?: LogCauseRef;
}

export interface MechanicLogParams {
  mechanic: 'named_trigger' | 'status_transition';
  displayName: string;
  internalKey: string;
  target?: 'caster' | 'target';
  visibility?: 'player' | 'debug';
  operation?: 'apply' | 'refresh' | 'replace' | 'consume';
  previousDisplayName?: string;
  triggerBasis?: MechanicTriggerBasisRef;
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
  remainingUses?: number;
  displayName?: string;
  /** 形态清除时一并移除的状态。 */
  cleanupBuffIds?: string[];
}

export interface LifestealParams {
  ratio: number;
  maxHpRatioPerAction: number;
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
    | { type: 'refund_paid_cost'; params: RefundPaidCostParams }
    | { type: 'buff_periodic_settlement'; params: BuffPeriodicSettlementParams }
    | { type: 'mechanic_log'; params: MechanicLogParams }
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
    | { type: 'lifesteal'; params: LifestealParams }
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
  /** 状态栏可见性；缺省时沿用日志可见性以保持兼容。 */
  statusVisibility?: 'player' | 'hidden';
  stackRule: StackRule;
  /** 同 ID 刷新型 Buff 的效果强度；更高值替换较低值，缺省为 0。 */
  stackPriority?: number;
  maxLayers?: number;
  /** 默认状态可被驱散、转移；protected 状态只能由自身机制移除。 */
  dispelPolicy?: 'normal' | 'protected';
  /** 是否计入普通增益、减益或控制数量，默认 true。 */
  countsAsStatus?: boolean;
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
  /** 供通用手动结算效果复用的原始周期效果。 */
  manualSettlementEffects?: EffectConfig[];
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

  /**
   * 主动效果链 (主动技能执行时触发)
   */
  effects?: EffectConfig[];

  /** 所有主效果层结算完成后执行；合法 no-op 不阻止该阶段。 */
  completionEffects?: EffectConfig[];

  /** 只能由 effectPlans 追加的效果层。 */
  effectLayers?: AbilityEffectLayerConfig[];

  /** 按运行时条件选择一个计划；未命中时仅执行基础效果。 */
  effectPlans?: AbilityEffectPlanConfig[];

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
