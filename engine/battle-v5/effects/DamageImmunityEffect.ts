import { DamageImmunityParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { DamageEvent, DamageImmuneEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 伤害免疫原子效果
 */
export class DamageImmunityEffect extends GameplayEffect {
  constructor(private readonly params: DamageImmunityParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { triggerEvent, target } = context;
    if (!triggerEvent || triggerEvent.type !== 'DamageEvent') {
      return;
    }

    const event = triggerEvent as DamageEvent;
    if (event.finalDamage <= 0) {
      return;
    }

    const matchedTag = this.params.tags.find(
      (tag) => event.ability?.tags.hasTag(tag) || event.buff?.tags.hasTag(tag),
    );
    if (!matchedTag) {
      return;
    }

    const blockedDamage = event.finalDamage;
    event.finalDamage = 0;

    EventBus.instance.publish<DamageImmuneEvent>({
      type: 'DamageImmuneEvent',
      timestamp: Date.now(),
      caster: event.caster,
      target,
      ability: event.ability,
      buff: event.buff,
      blockedDamage,
      matchedTag,
    });
  }
}

EffectRegistry.getInstance().register(
  'damage_immunity',
  (params) => new DamageImmunityEffect(params),
);