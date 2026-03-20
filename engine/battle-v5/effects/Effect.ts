import { Ability } from '../abilities/Ability';
import { Unit } from '../units/Unit';

/**
 * 效果执行上下文
 */
export interface EffectContext {
  caster: Unit;
  target: Unit;
  ability?: Ability;
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
