import { ResourceDrainParams } from '../core/configs';
import { DamageTakenEvent, ResourceDrainEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';

/**
 * 资源夺取原子效果 (吸血/吸蓝)
 * 依赖于触发它的伤害事件数据
 */
export class ResourceDrainEffect extends GameplayEffect {
  constructor(private params: ResourceDrainParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const { caster, target, ability, triggerEvent } = context;

    // 只有在受击事件触发时才生效，因为需要知道造成的实际伤害
    if (!triggerEvent || triggerEvent.type !== 'DamageTakenEvent') {
      return;
    }

    const damageEvent = triggerEvent as DamageTakenEvent;
    const amount = Math.round(damageEvent.damageTaken * this.params.ratio);

    if (amount <= 0) return;

    const appliedAmount = this.params.targetType === 'hp'
      ? caster.heal(amount)
      : caster.restoreMp(amount);
    if (appliedAmount <= 0) return;

    context.commit(caster, {
      type: 'recovery',
      resource: this.params.targetType,
      amount: Math.round(appliedAmount),
      after: Math.round(
        this.params.targetType === 'hp'
          ? caster.getCurrentHp()
          : caster.getCurrentMp(),
      ),
    });

    // 发布资源夺取事件
    context.emit<ResourceDrainEvent>({
      type: 'ResourceDrainEvent',
      timestamp: context.owner.runtime.clock.now(),
      caster,
      target,
      ability,
      drainType: this.params.targetType,
      amount: appliedAmount,
    });
  }
}

// 注册
EffectRegistry.getInstance().register(
  'resource_drain',
  (params) => new ResourceDrainEffect(params),
);
