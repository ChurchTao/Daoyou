import { Ability } from './Ability';
import { AbilityId, AbilityType } from '../core/types';
import { Unit } from '../units/Unit';

/**
 * 主动技能基类
 * 有MP消耗、冷却时间、触发条件
 */
export abstract class ActiveSkill extends Ability {
  protected _mpCost: number;
  private readonly _skillCooldown: number;

  constructor(id: AbilityId, name: string, mpCost: number = 0, cooldown: number = 0) {
    super(id, name, AbilityType.ACTIVE_SKILL);
    this._mpCost = mpCost;
    this._skillCooldown = cooldown;
    this.setCooldown(cooldown);
  }

  canExecute(unit: Unit): boolean {
    // 检查冷却
    if (!this.isReady()) return false;

    // 检查MP
    if (unit.currentMp < this._mpCost) return false;

    // 检查自定义条件 (pass unit as both caster and target for self-cast skills)
    return this.canTrigger({ caster: unit, target: unit });
  }

  executeWithTarget(unit: Unit, target: Unit): void {
    if (!this.canExecute(unit)) {
      return;
    }

    // 消耗MP
    unit.consumeMp(this._mpCost);

    // 开始冷却
    this.startCooldown();

    // 执行技能效果
    this.executeSkill(unit, target);
  }

  /**
   * ActiveSkill overrides canTrigger to not require owner
   * since it receives the unit as a parameter
   */
  canTrigger(_context: { caster: Unit; target: Unit }): boolean {
    // Base implementation allows trigger, subclasses can override
    return true;
  }

  /**
   * 子类实现具体技能效果
   */
  protected abstract executeSkill(caster: Unit, target: Unit): void;

  getMpCost(): number {
    return this._mpCost;
  }

  getCooldown(): number {
    return this._skillCooldown;
  }
}
