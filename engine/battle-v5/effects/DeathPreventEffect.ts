import { EventBus } from '../core/EventBus';
import { DamageTakenEvent, DeathPreventEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 免死原子效果
 */
export class DeathPreventEffect extends GameplayEffect {
  execute(context: EffectContext): void {
    const { target, triggerEvent, ability } = context;

    if (!triggerEvent || triggerEvent.type !== 'DamageTakenEvent') {
      return;
    }

    // 全局仅触发一次：检查 EventBus 历史中是否已有相同事件
    const alreadyTriggered = EventBus.instance
      .getEventHistory()
      .some((e) => e.type === 'DeathPreventEvent' && (e as DeathPreventEvent).target.id === target.id);
    if (alreadyTriggered) return;

    const damageTakenEvent = triggerEvent as DamageTakenEvent;

    if (damageTakenEvent.isLethal) {
      target.setHp(1); // 将 HP 设置为 1，避免死亡

      // 发布免死事件
      EventBus.instance.publish<DeathPreventEvent>({
        type: 'DeathPreventEvent',
        timestamp: Date.now(),
        target,
        ability,
      });
    }
  }
}

// 注册
EffectRegistry.getInstance().register(
  'death_prevent',
  () => new DeathPreventEffect(),
);
