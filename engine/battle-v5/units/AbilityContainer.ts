import { Unit } from './Unit';
import { Ability } from '../abilities/Ability';
import { EventBus } from '../core/EventBus';
import { ActionEvent, SkillPreCastEvent, EventPriorityLevel } from '../core/events';
import { ActiveSkill } from '../abilities/ActiveSkill';
import { BasicAttack } from '../abilities/BasicAttack';

export class AbilityContainer {
  private _abilities = new Map<string, Ability>();
  private _owner: Unit;
  private _defaultTarget: Unit | null = null;
  private _defaultAttack: Ability | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handlers: Map<string, (event: any) => void> = new Map();

  constructor(owner: Unit) {
    this._owner = owner;
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    const actionEventHandler = (event: ActionEvent) => this._onActionTrigger(event);
    EventBus.instance.subscribe<ActionEvent>(
      'ActionEvent',
      actionEventHandler,
      EventPriorityLevel.ACTION_TRIGGER,
    );
    this._handlers.set('ActionEvent', actionEventHandler);
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
      // 无可用技能，使用普攻
      const target = this._getDefaultTarget();
      if (target && target.id !== this._owner.id) {
        this._prepareCast(this._getDefaultAttack(), target);
      }
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
   * 设置默认目标（敌方单位）
   */
  setDefaultTarget(target: Unit): void {
    this._defaultTarget = target;
  }

  /**
   * 清除默认目标
   */
  clearDefaultTarget(): void {
    this._defaultTarget = null;
  }

  /**
   * 获取默认目标
   * 注意：这个方法需要从战斗上下文获取敌方单位
   * 当前实现返回占位符，后续任务会完善
   */
  private _getDefaultTarget(): Unit {
    // Use the set default target if available
    if (this._defaultTarget) {
      return this._defaultTarget;
    }
    // TODO: 从战斗上下文获取敌方单位
    // 当前返回自身作为占位符
    return this._owner;
  }

  /**
   * 获取默认攻击（普攻）
   */
  private _getDefaultAttack(): Ability {
    if (!this._defaultAttack) {
      this._defaultAttack = new BasicAttack();
      this._defaultAttack.setOwner(this._owner);
      this._defaultAttack.setActive(true);
    }
    return this._defaultAttack;
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

  /**
   * 销毁容器，取消订阅
   */
  destroy(): void {
    for (const [eventType, handler] of this._handlers) {
      EventBus.instance.unsubscribe(eventType, handler);
    }
    this._handlers.clear();
  }
}
