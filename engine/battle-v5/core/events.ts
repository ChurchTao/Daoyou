// engine/battle-v5/core/events.ts
import { CombatEvent, EventPriority } from './types';
import { Unit } from '../units/Unit';
import { Ability } from '../abilities/Ability';

// ===== 事件优先级枚举 =====
export enum EventPriorityLevel {
  ACTION_TRIGGER = 80,     // 行动阶段触发（最高）
  SKILL_PRE_CAST = 75,     // 施法前摇&打断判定
  SKILL_CAST = 70,         // 技能正式释放
  HIT_CHECK = 65,          // 命中判定
  DAMAGE_CALC = 60,        // 伤害计算
  DAMAGE_APPLY = 55,       // 伤害应用
  DAMAGE_TAKEN = 50,       // 受击事件（触发被动/反伤）
  POST_SETTLE = 30,        // 后置结算
  COMBAT_LOG = 10,         // 战报输出（最低）
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
}

// ===== 伤害应用事件 =====
export interface DamageEvent extends CombatEvent {
  type: 'DamageEvent';
  caster: Unit;
  target: Unit;
  ability: Ability;
  finalDamage: number;
}

// ===== 受击事件 =====
export interface DamageTakenEvent extends CombatEvent {
  type: 'DamageTakenEvent';
  caster: Unit;
  target: Unit;
  damageTaken: number;
  remainHealth: number;
  isLethal: boolean;
}

// ===== 单元死亡事件 =====
export interface UnitDeadEvent extends CombatEvent {
  type: 'UnitDeadEvent';
  unit: Unit;
  killer: Unit;
}
