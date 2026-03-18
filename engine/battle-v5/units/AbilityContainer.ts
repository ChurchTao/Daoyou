import { Unit } from './Unit';
import { Ability } from '../abilities/Ability';
import { EventBus } from '../core/EventBus';
import { ActionEvent, SkillPreCastEvent, EventPriorityLevel } from '../core/events';
import { ActiveSkill } from '../abilities/ActiveSkill';

export class AbilityContainer {
  private _abilities = new Map<string, Ability>();
  private _owner: Unit;

  constructor(owner: Unit) {
    this._owner = owner;
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    EventBus.instance.subscribe<ActionEvent>(
      'ActionEvent',
      (event) => this._onActionTrigger(event),
      EventPriorityLevel.ACTION_TRIGGER,
    );
  }

  /**
   * 响应行动触发事件，执行技能筛选
   */
  private _onActionTrigger(event: ActionEvent): void {
    // 仅当前出手单位是自己时，才执行筛选
    if (event.caster.id !== this._owner.id) return;

    // 获取可用技能
    const availableAbilities = this.getAvailableAbilities();

    if (availableAbilities.length === 0) {
      // 无可用技能时暂不处理，后续任务会实现普攻
      return;
    }

    // 按优先级排序，选择最高优先级技能
    const sortedAbilities = availableAbilities.sort((a, b) => b.priority - a.priority);
    const selectedAbility = sortedAbilities[0];

    this._prepareCast(selectedAbility, this._getDefaultTarget());
  }

  /**
   * 获取所有可用技能（蓝量足够、冷却完毕）
   */
  getAvailableAbilities(): Ability[] {
    return Array.from(this._abilities.values())
      .filter(ability => ability instanceof ActiveSkill)
      .filter(ability => ability.canTrigger({ caster: this._owner, target: this._getDefaultTarget() }));
  }

  /**
   * 准备施法：进入前摇阶段
   */
  private _prepareCast(ability: Ability, target: Unit): void {
    // 消耗蓝量
    if (ability.manaCost > 0) {
      this._owner.consumeMp(ability.manaCost);
    }

    // 发布施法前摇事件
    EventBus.instance.publish<SkillPreCastEvent>({
      type: 'SkillPreCastEvent',
      priority: EventPriorityLevel.SKILL_PRE_CAST,
      timestamp: Date.now(),
      caster: this._owner,
      target,
      ability,
      isInterrupted: false,
    });
  }

  /**
   * 获取默认目标
   * 注意：这个方法需要从战斗上下文获取敌方单位
   * 当前实现返回占位符，后续任务会完善
   */
  private _getDefaultTarget(): Unit {
    // TODO: 从战斗上下文获取敌方单位
    // 当前返回自身作为占位符
    return this._owner;
  }

  addAbility(ability: Ability): void {
    this._abilities.set(ability.id, ability);
    ability.setOwner(this._owner);
    ability.setActive(true);
  }

  removeAbility(abilityId: string): void {
    const ability = this._abilities.get(abilityId);
    if (ability) {
      ability.setActive(false);
      this._abilities.delete(abilityId);
    }
  }

  getAbility(abilityId: string): Ability | undefined {
    return this._abilities.get(abilityId);
  }

  getAllAbilities(): Ability[] {
    return Array.from(this._abilities.values());
  }

  clone(owner: Unit): AbilityContainer {
    const clone = new AbilityContainer(owner);
    // TODO: 实现深拷贝：遍历 this._abilities，复制每个 Ability 实例并添加到 clone
    // 当前返回空容器，适用于 Ability 系统未完成时的占位实现
    return clone;
  }
}
