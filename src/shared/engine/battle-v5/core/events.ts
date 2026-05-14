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
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  技能伤害: SkillCastEvent → HitCheckEvent → DamageRequestEvent     │
 * │  DOT伤害:  ActionPreEvent ─────────────────→ DamageRequestEvent     │
 * │  反伤等:   其他来源 ──────────────────────→ DamageRequestEvent     │
 * └─────────────────────────────────────────────────────────────────────┘
 *                              ↓
 *         DamageRequestEvent → [增伤修正] → [减伤/随机] → DamageEvent
 *                              ↓
 *         DamageEvent → [护盾/无敌响应] → 气血更新 → DamageTakenEvent
 */
import { Ability } from '../abilities/Ability';
import { Buff } from '../buffs/Buff';
import { Unit } from '../units/Unit';
import type { TagPath } from '@shared/engine/shared/tag-domain';
import { CombatEvent, DamageSource, DamageType } from './types';

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
  ROUND_PRE = 45, // 回合前置结算（DOT、BUFF结算等）
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

// ===== 行动阶段触发事件 =====
export interface ActionEvent extends CombatEvent {
  type: 'ActionEvent';
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
  ability: Ability;
  isInterrupted: boolean;
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
  // 控制字段：由 DamageSystem 等系统在事件流转中填充
  isHit?: boolean; // 是否命中
  isDodged?: boolean; // 是否被闪避
  isResisted?: boolean; // 是否被抵抗
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
}

// ===== 伤害请求事件 =====
// 语义：请求造成伤害，进入统一伤害计算管道
// 用途：增伤效果（如「毒术精通」）订阅此事件修正 finalDamage
// 来源：技能伤害、DOT 伤害、反伤等所有伤害来源
export interface DamageRequestEvent extends CombatEvent {
  type: 'DamageRequestEvent';
  caster?: Unit; // null 表示 DOT 伤害或环境伤害
  target: Unit;
  ability?: Ability; // null 表示非技能来源的伤害
  buff?: Buff; // 新增：如果是 Buff 造成的伤害，记录来源 Buff
  damageSource?: DamageSource;
  damageType?: DamageType;
  baseDamage: number; // 基础伤害（未修正）
  finalDamage: number; // 最终伤害（可被增伤修正）
  // 同乘区加算桶：同一次伤害事件内累加，统一在 DamageSystem 中一次结算
  damageIncreasePctBucket?: number;
  damageReductionPctBucket?: number;
  isCritical?: boolean; // 是否暴击
  critMultiplier?: number; // 暴击倍率
}

// ===== 伤害应用事件 =====
// 语义：伤害即将应用到目标身上
// 用途：护盾/无敌/伤害免疫效果订阅此事件拦截伤害
// 注意：此事件由 DamageSystem 发布，不再由 DamageSystem 订阅
export interface DamageEvent extends CombatEvent {
  type: 'DamageEvent';
  caster?: Unit; // null 表示 DOT 伤害或环境伤害
  target: Unit;
  ability?: Ability; // null 表示非技能来源的伤害
  buff?: Buff; // 新增：记录来源 Buff
  damageSource?: DamageSource;
  damageType?: DamageType;
  finalDamage: number;
  isCritical?: boolean; // 是否暴击
  critMultiplier?: number; // 暴击倍率
}

// ===== 真元护盾抵扣事件 =====
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
  tag: string;
}

// ===== 免死触发事件 =====
export interface DeathPreventEvent extends CombatEvent {
  type: 'DeathPreventEvent';
  target: Unit;
  ability?: Ability;
}

// ===== 受击事件 =====
export interface DamageTakenEvent extends CombatEvent {
  type: 'DamageTakenEvent';
  caster?: Unit; // null 表示 DOT 伤害或环境伤害
  target: Unit;
  ability?: Ability; // null 表示非技能来源的伤害
  buff?: Buff; // 新增：如果是 Buff 造成的伤害，记录来源 Buff
  damageSource?: DamageSource;
  damageType?: DamageType;
  reflectSourceName?: string;
  damageTaken: number;
  beforeHp: number;
  remainHp: number;
  shieldAbsorbed?: number; // 护盾抵扣值
  remainShield?: number; // 剩余护盾值
  isLethal: boolean;
  isCritical?: boolean; // 是否暴击
  critMultiplier?: number; // 暴击倍率
}

// ===== 单元死亡事件 =====
export interface UnitDeadEvent extends CombatEvent {
  type: 'UnitDeadEvent';
  unit: Unit;
  killer?: Unit;
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
  isCancelled?: boolean;
  immuneTag?: TagPath;
}

// ===== BUFF 成功应用事件 =====
export interface BuffAppliedEvent extends CombatEvent {
  type: 'BuffAppliedEvent';
  target: Unit;
  buff: Buff;
  source?: Unit | Ability | unknown; // 来源（施法者/技能）
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
  winner: string | null;
  turns: number;
}

// ===== 控制跳过事件（单位因受控而跳过本回合行动）=====
export interface ControlledSkipEvent extends CombatEvent {
  type: 'ControlledSkipEvent';
  unit: Unit;
  /** 触发跳过的控制标签路径 */
  controlTag: string;
}
