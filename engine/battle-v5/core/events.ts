// engine/battle-v5/core/events.ts
import { Ability } from '../abilities/Ability';
import { Buff } from '../buffs/Buff';
import { Unit } from '../units/Unit';
import { CombatEvent, TagPath } from './types';

// ===== 事件优先级枚举 =====
export enum EventPriorityLevel {
  ACTION_TRIGGER = 80, // 行动阶段触发（最高）
  SKILL_PRE_CAST = 75, // 施法前摇&打断判定
  SKILL_CAST = 70, // 技能正式释放
  HIT_CHECK = 65, // 命中判定
  DAMAGE_CALC = 60, // 伤害计算
  DAMAGE_APPLY = 55, // 伤害应用
  DAMAGE_TAKEN = 50, // 受击事件（触发被动/反伤）
  BUFF_INTERCEPT = 40, // BUFF 拦截（高于 POST_SETTLE）
  TAG_CHANGE = 35, // 标签变更
  POST_SETTLE = 30, // 后置结算
  COMBAT_LOG = 10, // 战报输出（最低）
}

// ===== 行动阶段触发事件 =====
export interface ActionEvent extends CombatEvent {
  type: 'ActionEvent';
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
  ability: Ability;
  reason: string;
}

// ===== 技能正式释放事件 =====
export interface SkillCastEvent extends CombatEvent {
  type: 'SkillCastEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
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

// ===== 伤害计算事件 =====
export interface DamageCalculateEvent extends CombatEvent {
  type: 'DamageCalculateEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  baseDamage: number;
  finalDamage: number;
  isCritical?: boolean; // 是否暴击
  critMultiplier?: number; // 暴击倍率
}

// ===== 伤害应用事件 =====
export interface DamageEvent extends CombatEvent {
  type: 'DamageEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  finalDamage: number;
  isCritical?: boolean; // 是否暴击
  critMultiplier?: number; // 暴击倍率
}

// ===== 受击事件 =====
export interface DamageTakenEvent extends CombatEvent {
  type: 'DamageTakenEvent';
  caster: Unit;
  target: Unit;
  ability: Ability; // 造成伤害的技能
  damageTaken: number;
  remainHealth: number;
  isLethal: boolean;
  isCritical?: boolean; // 是否暴击
  critMultiplier?: number; // 暴击倍率
}

// ===== 单元死亡事件 =====
export interface UnitDeadEvent extends CombatEvent {
  type: 'UnitDeadEvent';
  unit: Unit;
  killer: Unit;
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

// ===== 回合开始事件（用于 DOT 处理） =====
export interface TurnStartEvent extends CombatEvent {
  type: 'TurnStartEvent';
  turn: number;
  activeUnit: Unit;
}

// ===== 回合结束事件 =====
export interface TurnEndEvent extends CombatEvent {
  type: 'TurnEndEvent';
  turn: number;
  activeUnit: Unit;
}
