import { Ability } from './Ability';
import { AbilityId, AbilityType } from '../core/types';
import { Unit } from '../units/Unit';

/**
 * 主动技能基类
 * 有MP消耗、冷却时间、触发条件
 */
export abstract class ActiveSkill extends Ability {
  private readonly _skillCooldown: number;

  constructor(id: AbilityId, name: string, mpCost: number = 0, cooldown: number = 0) {
    super(id, name, AbilityType.ACTIVE_SKILL);
    this._skillCooldown = cooldown;
    this.setCooldown(cooldown);
    this.setManaCost(mpCost);
  }

  /**
   * 重写 canTrigger 以支持主动技能的特殊检查
   * 注意：冷却检查已在基类 Ability.canTrigger 中完成
   * 这里只检查蓝量和自定义条件
   */
  canTrigger(context: { caster: Unit; target: Unit }): boolean {
    // 基类已检查冷却 (isReady()) 和蓝量 (manaCost)
    // 这里调用基类方法保持一致性
    return super.canTrigger(context);
  }

  /**
   * 重写执行方法，整合技能效果执行
   */
  override execute(context: { caster: Unit; target: Unit }): void {
    // 消耗MP
    context.caster.consumeMp(this.manaCost);

    // 开始冷却
    this.startCooldown();

    // 执行技能效果
    this.executeSkill(context.caster, context.target);
  }

  /**
   * 直接执行技能（用于测试）
   * 注意：战斗系统通过事件系统执行技能，不使用此方法
   * 此方法会检查 MP 和冷却，如果不满足条件则不执行
   */
  executeWithTarget(unit: Unit, target: Unit): void {
    // 检查是否可以触发（MP、冷却等）
    if (!this.canTrigger({ caster: unit, target })) {
      return;
    }

    // 消耗MP
    unit.consumeMp(this.manaCost);

    // 开始冷却
    this.startCooldown();

    // 执行技能效果
    this.executeSkill(unit, target);
  }

  /**
   * 子类实现具体技能效果
   */
  protected abstract executeSkill(caster: Unit, target: Unit): void;

  /**
   * 获取技能冷却时间
   */
  getCooldown(): number {
    return this._skillCooldown;
  }
}
