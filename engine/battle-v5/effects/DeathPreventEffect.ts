import { GameplayEffect, EffectContext } from './Effect';
import { DamageTakenEvent, DeathPreventEvent, EventPriorityLevel } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EventBus } from '../core/EventBus';

/**
 * 免死原子效果
 */
export class DeathPreventEffect extends GameplayEffect {
  execute(context: EffectContext): void {
    const { target, triggerEvent, ability } = context;

    if (!triggerEvent || triggerEvent.type !== 'DamageTakenEvent') {
      return;
    }

    const damageTakenEvent = triggerEvent as DamageTakenEvent;

    if (damageTakenEvent.isLethal) {
      target.setHp(1); // 将 HP 设置为 1，避免死亡

      // 发布免死事件
      EventBus.instance.publish<DeathPreventEvent>({
        type: 'DeathPreventEvent',
        priority: EventPriorityLevel.POST_SETTLE,
        timestamp: Date.now(),
        target,
        ability,
      });
    }
  }
}

// 注册
EffectRegistry.getInstance().register('death_prevent', () => new DeathPreventEffect());
