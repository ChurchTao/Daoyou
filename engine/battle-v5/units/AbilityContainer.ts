import { Unit } from './Unit';
import { Ability, AbilityContext } from '../abilities/Ability';
import { EventBus } from '../core/EventBus';
import { ActionEvent, SkillPreCastEvent, EventPriorityLevel } from '../core/events';
import { ActiveSkill } from '../abilities/ActiveSkill';
import { BasicAttack } from '../abilities/BasicAttack';

/**
 * AbilityContainer - 技能容器
 *
 * 职责：
 * - 管理单位的所有技能（存储、添加、移除）
 * - 响应 ActionEvent 进行技能筛选
 * - 发布 SkillPreCastEvent 进入施法流程
 *
 * 不负责：
 * - 目标选择（由 TargetSelectionSystem 处理）
 * - 技能执行（由 AbilityExecutionSystem 处理）
 */
export class AbilityContainer {
  private _abilities = new Map<string, Ability>();
  private _owner: Unit;
  private _defaultTarget: Unit | null = null;
  private _defaultAttack: Ability | null = null;
  private _handlers: Map<string, (event: unknown) => void> = new Map();

  constructor(owner: Unit) {
    this._owner = owner;
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    const actionEventHandler = (event: unknown) => this._onActionTrigger(event as ActionEvent);
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

    // 获取默认目标（由 BattleEngineV5 设置）
    const target = this._getDefaultTarget();
    // 无目标或目标为自身时，不执行技能
    if (!target || target.id === this._owner.id) return;

    // 获取可用技能
    const availableAbilities = this.getAvailableAbilities(target);

    if (availableAbilities.length === 0) {
      // 无可用技能，使用普攻
      this._prepareCast(this._getDefaultAttack(), target);
      return;
    }

    // 按优先级排序，选择最高优先级技能
    const selectedAbility = availableAbilities.reduce((best, current) =>
      current.priority > best.priority ? current : best,
    );

    this._prepareCast(selectedAbility, target);
  }

  /**
   * 获取所有可用技能（冷却完毕、资源足够）
   */
  getAvailableAbilities(target: Unit): Ability[] {
    const context: AbilityContext = {
      caster: this._owner,
      target,
    };

    return Array.from(this._abilities.values())
      .filter(ability => ability instanceof ActiveSkill)
      .filter(ability => ability.canTrigger(context));
  }

  /**
   * 准备施法：发布施法前摇事件
   */
  private _prepareCast(ability: Ability, target: Unit): void {
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

  // ===== 目标管理（简化版，由外部设置） =====

  setDefaultTarget(target: Unit): void {
    this._defaultTarget = target;
  }

  clearDefaultTarget(): void {
    this._defaultTarget = null;
  }

  private _getDefaultTarget(): Unit | null {
    return this._defaultTarget;
  }

  private _getDefaultAttack(): Ability {
    if (!this._defaultAttack) {
      this._defaultAttack = new BasicAttack();
      this._defaultAttack.setOwner(this._owner);
      this._defaultAttack.setActive(true);
    }
    return this._defaultAttack;
  }

  // ===== 技能管理 =====

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

  // ===== 克隆 =====

  clone(owner: Unit): AbilityContainer {
    const clonedContainer = new AbilityContainer(owner);

    for (const ability of this._abilities.values()) {
      const clonedAbility = ability.clone();
      clonedContainer._abilities.set(clonedAbility.id, clonedAbility);
      clonedAbility.setOwner(owner);
      clonedAbility.setActive(true);
    }

    return clonedContainer;
  }

  // ===== 销毁 =====

  destroy(): void {
    // 取消所有事件订阅
    for (const [eventType, handler] of this._handlers) {
      EventBus.instance.unsubscribe(eventType, handler);
    }
    this._handlers.clear();

    // 停用所有技能
    for (const ability of this._abilities.values()) {
      ability.setActive(false);
    }
  }
}
