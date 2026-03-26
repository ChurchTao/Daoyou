import { Ability } from '../abilities/Ability';
import { Buff } from '../buffs/Buff';
import { CombatEvent } from '../core/types';
import { Unit } from '../units/Unit';

/**
 * 效果执行上下文
 */
export interface EffectContext {
  caster: Unit;
  target: Unit;
  ability?: Ability;
  buff?: Buff;
  /**
   * 触发此效果的事件（可选）
   * 用于支持吸血、反伤、根据受击伤害触发的效果等
   */
  triggerEvent?: CombatEvent;
}

/**
 * 原子效果基类 (Atomic Gameplay Effect)
 *
 * 职责：
 * - 定义原子操作（伤害、治疗、加Buff等）
 * - 在特定的上下文中执行
 */
export abstract class GameplayEffect {
  /**
   * 执行效果
   * @param context 包含施法者、目标、所属技能的上下文
   */
  abstract execute(context: EffectContext): void;
}
