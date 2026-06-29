import { EventBus } from '../core/EventBus';
import { DeathPreventParams } from '../core/configs';
import { DamageTakenEvent, DeathPreventEvent } from '../core/events';
import { getBattleRuntimeState } from '../core/runtimeState';
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
    const { target, triggerEvent, ability, buff } = context;

    if (!triggerEvent || triggerEvent.type !== 'DamageTakenEvent') {
      return;
    }

    const damageTakenEvent = triggerEvent as DamageTakenEvent;

    if (damageTakenEvent.isLethal && target.getCurrentHp() <= 0) {
      const sourceKey =
        this.params.triggerKey ?? ability?.id ?? buff?.id ?? 'death_prevent';
      const runtimeState = getBattleRuntimeState(target);
      if (runtimeState.deathPreventTriggers.has(sourceKey)) return;

      let hpFloor = 1;
      if (this.params.hpFloorPercent !== undefined) {
        hpFloor = Math.max(
          1,
          Math.floor(
            target.getMaxHp() * Math.min(this.params.hpFloorPercent, 1),
          ),
        );
      }
      target.setHp(hpFloor); // 将气血设置为 hpFloor，避免死亡
      runtimeState.deathPreventTriggers.add(sourceKey);

      // 发布免死事件
      EventBus.instance.publish<DeathPreventEvent>({
        type: 'DeathPreventEvent',
        timestamp: Date.now(),
        target,
        ability,
        sourceKey,
        sourceName: ability?.name ?? buff?.name,
      });
    }
  }
}

// 注册
EffectRegistry.getInstance().register(
  'death_prevent',
  (params) => new DeathPreventEffect(params),
);
