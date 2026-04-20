import { EventBus } from '../core/EventBus';
import { DeathPreventParams } from '../core/configs';
import { DamageTakenEvent, DeathPreventEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 免死原子效果
 */
export class DeathPreventEffect extends GameplayEffect {
  constructor(private params: DeathPreventParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { target, triggerEvent, ability } = context;

    if (!triggerEvent || triggerEvent.type !== 'DamageTakenEvent') {
      return;
    }

    // 全局仅触发一次：检查 EventBus 历史中是否已有相同事件
    const alreadyTriggered = EventBus.instance
      .getEventHistory()
      .some(
        (e) =>
          e.type === 'DeathPreventEvent' &&
          (e as DeathPreventEvent).target.id === target.id,
      );
    if (alreadyTriggered) return;

    const damageTakenEvent = triggerEvent as DamageTakenEvent;

    if (damageTakenEvent.isLethal) {
      let hpFloor = 1;
      if (this.params.hpFloorPercent !== undefined) {
        hpFloor = Math.max(
          1,
          Math.floor(
            target.getMaxHp() * Math.min(this.params.hpFloorPercent, 1),
          ),
        );
      }
      target.setHp(hpFloor); // 将 HP 设置为 hpFloor，避免死亡

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
  (params) => new DeathPreventEffect(params),
);
