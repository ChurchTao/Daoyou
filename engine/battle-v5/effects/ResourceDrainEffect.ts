import { GameplayEffect, EffectContext } from './Effect';
import { DamageTakenEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { ResourceDrainParams } from '../core/configs';

/**
 * 资源夺取原子效果 (吸血/吸蓝)
 * 依赖于触发它的伤害事件数据
 */
export class ResourceDrainEffect extends GameplayEffect {
  constructor(private params: ResourceDrainParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { caster, triggerEvent } = context;

    // 只有在受击事件触发时才生效，因为需要知道造成的实际伤害
    if (!triggerEvent || triggerEvent.type !== 'DamageTakenEvent') {
      return;
    }

    const damageEvent = triggerEvent as DamageTakenEvent;
    const amount = damageEvent.damageTaken * this.params.ratio;

    if (amount <= 0) return;

    if (this.params.targetType === 'hp') {
      caster.heal(amount);
    } else {
      caster.restoreMp(amount);
    }
  }
}

// 注册
EffectRegistry.getInstance().register('resource_drain', (params) => new ResourceDrainEffect(params));
