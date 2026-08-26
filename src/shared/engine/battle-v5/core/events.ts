// engine/battle-v5/core/events.ts
/**
 * 战斗事件系统 - EDA 架构核心
 *
 * 事件驱动架构 (EDA) 设计原则：
 * - 所有战斗行为都通过事件触发
 * - 系统间通过发布/订阅事件进行通信
 * - 事件优先级决定执行顺序
 *
 * 统一伤害管道：
 * AbilityCastStarted → HitResolved → DamageSegmentRequested
 *   → DamageSegmentApplied → HitSettled
 */
import { Ability } from '../abilities/Ability';
import { Buff } from '../buffs/Buff';
import { Unit } from '../units/Unit';
import type { TagPath } from '@shared/engine/shared/tag-domain';
import {
  CombatEvent,
  type DamageComponent,
  type DamageCalculationMode,
  type LogCauseRef,
  type TeamId,
  DamageSource,
  DamageType,
} from './types';
import type {
  ActionHitPolicy,
  ActionInterruptPolicy,
  ActionStateAbilityView,
  ActionStatePhase,
  ActionStateType,
} from './actionState';
import type { CombatResolutionContext } from './resolution';

/** Events in the new action/cast/hit/segment resolution model. */
export interface ResolutionEvent extends CombatEvent {
  readonly resolution: CombatResolutionContext;
}

export interface ActionStartedEvent extends ResolutionEvent {
  readonly type: 'ActionStartedEvent';
  readonly actor: Unit;
}

export interface AbilityCastStartedEvent extends ResolutionEvent {
  readonly type: 'AbilityCastStartedEvent';
  readonly caster: Unit;
  readonly target: Unit;
  readonly ability: Ability;
}

export interface HitResolvedEvent extends ResolutionEvent {
  readonly type: 'HitResolvedEvent';
  readonly caster: Unit;
  readonly target: Unit;
  readonly ability: Ability;
  readonly isHit: boolean;
  readonly isDodged: boolean;
  readonly isResisted: boolean;
}

export interface DamageSegmentRequestedEvent extends ResolutionEvent {
  readonly type: 'DamageSegmentRequestedEvent';
  readonly caster?: Unit;
  readonly target: Unit;
  readonly ability?: Ability;
  readonly buff?: Buff;
  readonly damageSource?: DamageSource;
  readonly damageType?: DamageType;
  readonly calculationMode?: DamageCalculationMode;
  readonly cause?: LogCauseRef;
  readonly damageTags?: string[];
  readonly damageComponents?: DamageComponent[];
  baseDamage: number;
  finalDamage: number;
  damageIncreasePctBucket?: number;
  damageReductionPctBucket?: number;
  forceCritical?: boolean;
  canCrit?: boolean;
  canLifesteal?: boolean;
  isCritical?: boolean;
  critMultiplier?: number;
}

export interface DamageSegmentAppliedEvent extends ResolutionEvent {
  readonly type: 'DamageSegmentAppliedEvent';
  readonly caster?: Unit;
  readonly target: Unit;
  readonly ability?: Ability;
  readonly buff?: Buff;
  readonly damageSource?: DamageSource;
  readonly damageType?: DamageType;
  readonly calculationMode?: DamageCalculationMode;
  readonly cause?: LogCauseRef;
  readonly damageTags?: string[];
  readonly finalDamage: number;
  readonly isCritical?: boolean;
  readonly critMultiplier?: number;
  readonly canLifesteal?: boolean;
  readonly damageTaken: number;
  readonly beforeHp: number;
  readonly remainHp: number;
  readonly shieldAbsorbed: number;
  readonly remainShield: number;
  readonly hpReachedZeroBeforeReactions: boolean;
  readonly reflectSourceName?: string;
}

export interface HitSettledEvent extends ResolutionEvent {
  readonly type: 'HitSettledEvent';
  readonly caster: Unit;
  readonly target: Unit;
  readonly ability: Ability;
  readonly segmentCount: number;
}

export interface AbilityCastSettledEvent extends ResolutionEvent {
  readonly type: 'AbilityCastSettledEvent';
  readonly caster: Unit;
  readonly target: Unit;
  readonly ability: Ability;
}

export interface ActionFinishedEvent extends ResolutionEvent {
  readonly type: 'ActionFinishedEvent';
  readonly actor: Unit;
}

// ===== 事件优先级枚举 =====
// 数值越大优先级越高，越先执行
export enum EventPriorityLevel {
  ACTION_TRIGGER = 80, // 行动阶段触发（最高）
  SKILL_PRE_CAST = 75, // 施法前摇&打断判定
  SKILL_CAST = 70, // 技能正式释放
  HIT_CHECK = 65, // 命中判定
  DAMAGE_REQUEST = 60, // 伤害请求（增伤修正）
  DAMAGE_APPLY = 55, // 伤害应用（护盾/无敌响应）
  DAMAGE_TAKEN = 50, // 受击事件（触发被动/反伤）
  ROUND_POST_RECOVERY = 46, // 回合结束周期恢复
  ROUND_PRE = 45, // 回合前置结算（DOT、BUFF结算等）
  ROUND_POST_DRAIN = 44, // 回合结束周期损耗（DOT、资源扣除）
  BUFF_INTERCEPT = 40, // BUFF 拦截（高于 POST_SETTLE）
  TAG_CHANGE = 35, // 标签变更
  POST_SETTLE = 30, // 后置结算
  COMBAT_LOG = 10, // 战报输出（最低）
}

// ===== 回合前置事件 =====
export interface RoundPreEvent extends CombatEvent {
  type: 'RoundPreEvent';
  turn: number;
}

// ===== 行动阶段前置触发事件 =====
export interface ActionPreEvent extends CombatEvent {
  type: 'ActionPreEvent';
  caster: Unit;
}

// ===== 行动阶段后置事件（技能结算完毕，Buff 过期处理前触发）=====
export interface ActionPostEvent extends CombatEvent {
  type: 'ActionPostEvent';
  caster: Unit;
}

// ===== 施法前摇事件 =====
export interface SkillPreCastEvent extends CombatEvent {
  type: 'SkillPreCastEvent';
  caster: Unit;
  target: Unit;
  /** Sealed team-cast targets. Omitted for a single-target cast. */
  targets?: Unit[];
  fallbackTarget?: Unit;
  ability: Ability;
  isInterrupted: boolean;
  /** 整个技能被免疫；优先于普通不可打断规则。 */
  isImmune?: boolean;
  /** 触发整技能免疫的通用来源名称，用于战报展示。 */
  immunityReason?: string;
  interruptPolicy?: ActionInterruptPolicy;
  hitPolicy?: ActionHitPolicy;
  queuedActionState?: {
    name: string;
    sourceAbility?: ActionStateAbilityView;
  };
}

// ===== 技能打断事件 =====
export interface SkillInterruptEvent extends CombatEvent {
  type: 'SkillInterruptEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  reason: string;
}

// ===== 技能正式释放事件 =====
export interface SkillCastEvent extends CombatEvent {
  type: 'SkillCastEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  interruptPolicy?: ActionInterruptPolicy;
  hitPolicy?: ActionHitPolicy;
  // 控制字段：由 DamageSystem 等系统在事件流转中填充
  isHit?: boolean; // 是否命中
  isDodged?: boolean; // 是否被闪避
  isResisted?: boolean; // 是否被抵抗
}

export interface AbilityCostPaidEvent extends CombatEvent {
  type: 'AbilityCostPaidEvent';
  caster: Unit;
  ability: Ability;
  beforeHp: number;
  afterHp: number;
  beforeMp: number;
  afterMp: number;
  hpPaid: number;
  mpPaid: number;
  beforeHpRatio: number;
  afterHpRatio: number;
}

export interface HpChangedEvent extends CombatEvent {
  type: 'HpChangedEvent';
  unit: Unit;
  beforeHp: number;
  afterHp: number;
  delta: number;
  reason: 'set' | 'damage' | 'heal' | 'ability_cost' | 'death_prevent' | 'initialization';
}

// ===== 命中判定事件 =====
export interface HitCheckEvent extends CombatEvent {
  type: 'HitCheckEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  isHit: boolean;
  isDodged: boolean;
  isResisted: boolean;
  hitPolicy?: ActionHitPolicy;
}

export interface DodgeEvent extends CombatEvent {
  type: 'DodgeEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
}

export interface ControlResistEvent extends CombatEvent {
  type: 'ControlResistEvent';
  caster: Unit;
  target: Unit;
  ability?: Ability;
  buff: Buff;
}

// ===== 法力护盾抵扣事件 =====
export interface ManaShieldAbsorbEvent extends CombatEvent {
  type: 'ManaShieldAbsorbEvent';
  caster?: Unit;
  target: Unit;
  ability?: Ability;
  buff?: Buff;
  absorbedDamage: number;
  mpConsumed: number;
  remainDamage: number;
}

// ===== 伤害免疫事件 =====
export interface DamageImmuneEvent extends CombatEvent {
  type: 'DamageImmuneEvent';
  caster?: Unit;
  target: Unit;
  ability?: Ability;
  buff?: Buff;
  blockedDamage: number;
  matchedTag: TagPath;
}

// ===== 治疗应用事件 =====
export interface HealEvent extends CombatEvent {
  type: 'HealEvent';
  caster: Unit;
  target: Unit;
  ability?: Ability;
  buff?: Buff; // 如果是 Buff 造成的治疗（如 HOT），记录来源 Buff
  healAmount: number;
  /** 实际恢复量；旧事件缺失时回退到 healAmount。 */
  appliedAmount?: number;
  healType?: 'hp' | 'mp'; // 默认 'hp'
}

// ===== 焚元应用事件 =====
export interface ManaBurnEvent extends CombatEvent {
  type: 'ManaBurnEvent';
  caster: Unit;
  target: Unit;
  ability?: Ability;
  burnAmount: number;
}

// ===== 护盾应用事件 =====
export interface ShieldEvent extends CombatEvent {
  type: 'ShieldEvent';
  caster: Unit;
  target: Unit;
  ability?: Ability;
  shieldAmount: number;
}

export interface ShieldBreakEvent extends CombatEvent {
  type: 'ShieldBreakEvent';
  caster?: Unit;
  target: Unit;
  ability?: Ability;
  buff?: Buff;
  brokenShieldAmount: number;
  overflowDamage: number;
  damageSource?: DamageSource;
}

// ===== 冷却修改事件 =====
export interface CooldownModifyEvent extends CombatEvent {
  type: 'CooldownModifyEvent';
  caster: Unit;
  target: Unit;
  ability?: Ability;
  cdModifyValue: number;
  affectedAbilityName: string;
}

// ===== 资源夺取事件 =====
export interface ResourceDrainEvent extends CombatEvent {
  type: 'ResourceDrainEvent';
  caster: Unit;
  target: Unit;
  ability?: Ability;
  drainType: 'hp' | 'mp';
  amount: number;
}

// ===== 自定义战斗资源变化事件 =====
export interface CombatResourceChangeEvent extends CombatEvent {
  type: 'CombatResourceChangeEvent';
  target: Unit;
  caster?: Unit;
  ability?: Ability;
  resourceId: string;
  resourceName: string;
  resourceMax: number;
  operation: 'add' | 'subtract' | 'set' | 'consume_all' | 'decay';
  reason?: 'gain' | 'spend' | 'refund' | 'decay';
  /** 请求变化量；增加为正，减少为负。 */
  requested: number;
  /** 实际变化量；增加为正，减少为负。 */
  applied: number;
  /** 因资源上限未能应用的正向变化量。 */
  overflow: number;
  before: number;
  after: number;
}

// ===== 驱散应用事件 =====
export interface DispelEvent extends CombatEvent {
  type: 'DispelEvent';
  caster: Unit;
  target: Unit;
  ability?: Ability;
  removedBuffNames: string[];
}

// ===== 标签触发事件 =====
export interface TagTriggerEvent extends CombatEvent {
  type: 'TagTriggerEvent';
  caster: Unit;
  target: Unit;
  ability?: Ability;
  displayName?: string;
  tag: string;
}

// ===== 免死触发事件 =====
export interface DeathPreventEvent extends CombatEvent {
  type: 'DeathPreventEvent';
  target: Unit;
  ability?: Ability;
  sourceKey?: string;
  sourceName?: string;
}

// ===== 标签添加事件 =====
export interface TagAddedEvent extends CombatEvent {
  type: 'TagAddedEvent';
  target: Unit;
  tag: TagPath;
  source?: unknown;
}

// ===== 标签移除事件 =====
export interface TagRemovedEvent extends CombatEvent {
  type: 'TagRemovedEvent';
  target: Unit;
  tag: TagPath;
  source?: unknown;
}

// ===== BUFF 添加拦截事件 =====
export interface BuffAddEvent extends CombatEvent {
  type: 'BuffAddEvent';
  target: Unit;
  buff: Buff;
  source?: Unit;
  isCancelled?: boolean;
  immuneTag?: TagPath;
}

// ===== BUFF 成功应用事件 =====
export interface BuffAppliedEvent extends CombatEvent {
  type: 'BuffAppliedEvent';
  target: Unit;
  buff: Buff;
  source?: Unit | Ability | unknown; // 来源（施法者/技能）
  ability?: Ability;
  sourceBuff?: Buff;
}

export type BuffLayerChangeReason = 'apply' | 'stack' | 'effect' | 'dispel';

/** BuffContainer 统一出口发布的状态层数变化事件。 */
export interface BuffLayerChangedEvent extends CombatEvent {
  type: 'BuffLayerChangedEvent';
  target: Unit;
  buff: Buff;
  source?: Unit;
  ability?: Ability;
  previousLayer: number;
  currentLayer: number;
  delta: number;
  reason: BuffLayerChangeReason;
  readonly resolution?: CombatResolutionContext;
}

// ===== BUFF 移除事件 =====
export interface BuffRemovedEvent extends CombatEvent {
  type: 'BuffRemovedEvent';
  target: Unit;
  buff: Buff;
  reason: 'manual' | 'expired' | 'dispel' | 'replace'; // 移除原因
}

// ===== BUFF 免疫拦截事件 =====
export interface BuffImmuneEvent extends CombatEvent {
  type: 'BuffImmuneEvent';
  target: Unit;
  buff: Buff;
  immuneTag: TagPath; // 触发免疫的标签
}

// ===== 战斗初始化事件 =====
export interface BattleInitEvent extends CombatEvent {
  type: 'BattleInitEvent';
  player: Unit;
  opponent: Unit;
  /** Complete roster for Team/Roster-aware listeners. */
  units?: Unit[];
}

// ===== 回合开始事件（状态机驱动） =====
export interface RoundStartEvent extends CombatEvent {
  type: 'RoundStartEvent';
  turn: number;
}

// ===== 行动顺序确定事件 =====
export interface TurnOrderEvent extends CombatEvent {
  type: 'TurnOrderEvent';
  turn: number;
  units: Unit[]; // 按速度排序后的行动顺序
}

// ===== 回合后置结算事件 =====
export interface RoundPostEvent extends CombatEvent {
  type: 'RoundPostEvent';
  turn: number;
}

// ===== 胜负判定事件 =====
export interface VictoryCheckEvent extends CombatEvent {
  type: 'VictoryCheckEvent';
  turn: number;
  battleEnded: boolean;
  winner: string | null;
}

// ===== 战斗结束事件 =====
export interface BattleEndEvent extends CombatEvent {
  type: 'BattleEndEvent';
  /** Legacy winner unit id; the first surviving winner-team unit in team battles. */
  winner: string | null;
  winnerTeamId?: TeamId;
  turns: number;
}

// ===== 控制跳过事件（单位因受控而跳过本回合行动）=====
export interface ControlledSkipEvent extends CombatEvent {
  type: 'ControlledSkipEvent';
  unit: Unit;
  /** 触发跳过的控制标签路径 */
  controlTag: string;
}

export interface ActionStateEvent extends CombatEvent {
  type: 'ActionStateEvent';
  unit: Unit;
  stateType: ActionStateType;
  phase: ActionStatePhase;
  name: string;
  remainingActions: number;
  sourceAbility?: ActionStateAbilityView;
  ability?: ActionStateAbilityView;
  reason?: string;
}
