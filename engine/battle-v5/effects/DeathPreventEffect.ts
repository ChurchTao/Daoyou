import { GameplayEffect, EffectContext } from './Effect';
import { DamageTakenEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';

/**
 * 免死原子效果
 */
export class DeathPreventEffect extends GameplayEffect {
  execute(context: EffectContext): void {
    const { target, triggerEvent } = context;

    if (!triggerEvent || triggerEvent.type !== 'DamageTakenEvent') {
      return;
    }

    const damageTakenEvent = triggerEvent as DamageTakenEvent;

    if (damageTakenEvent.isLethal) {
      target.currentHp = 1;
    }
  }
}

// 注册
EffectRegistry.getInstance().register('death_prevent', () => new DeathPreventEffect());
