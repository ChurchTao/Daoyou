import { DamageImmunityParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { DamageEvent, DamageImmuneEvent } from '../core/events';
import { DamageType } from '../core/types';
import { EffectRegistry } from '../factories/EffectRegistry';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
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
      (tag) =>
        event.ability?.tags.hasTag(tag) ||
        event.buff?.tags.hasTag(tag) ||
        (tag === GameplayTags.ABILITY.CHANNEL.TRUE &&
          event.damageType === DamageType.TRUE) ||
        (tag === GameplayTags.ABILITY.CHANNEL.MAGIC &&
          event.damageType === DamageType.MAGICAL) ||
        (tag === GameplayTags.ABILITY.CHANNEL.PHYSICAL &&
          event.damageType === DamageType.PHYSICAL),
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
