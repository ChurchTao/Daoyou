import { Ability } from './Ability';
import { AbilityId, AbilityType, CombatEvent } from '../core/types';
import { Unit } from '../units/Unit';

/**
 * 被动能力基类
 * 通过事件触发，包括被动技能和命格
 */
export abstract class PassiveAbility extends Ability {
  constructor(id: AbilityId, name: string) {
    super(id, name, AbilityType.PASSIVE_SKILL);
  }

  protected protectedOnActivate(): void {
    // 子类订阅事件
    this.setupEventListeners();
    super.protectedOnActivate();
  }

  /**
   * 子类实现，设置事件监听
   */
  protected abstract setupEventListeners(): void;

  /**
   * 通用事件处理包装器
   */
  protected createEventHandler(handler: (event: CombatEvent) => void): (event: CombatEvent) => void {
    return (event: CombatEvent) => {
      const owner = this.getOwner();
      if (!owner || !owner.isAlive()) return;

      handler(event);
    };
  }
}
