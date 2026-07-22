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

    const matchedTag = this.params.tags.find((tag) =>
      matchesDamageTag(event, tag),
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

function matchesDamageTag(event: DamageEvent, tag: string): boolean {
  if (tag === GameplayTags.ABILITY.CHANNEL.MAGIC) {
    return event.damageType === DamageType.MAGICAL;
  }
  if (tag === GameplayTags.ABILITY.CHANNEL.TRUE) {
    return event.damageType === DamageType.TRUE;
  }
  if (tag === GameplayTags.ABILITY.CHANNEL.PHYSICAL) {
    return event.damageType === DamageType.PHYSICAL;
  }

  return (
    event.ability?.tags.hasTag(tag) ||
    event.buff?.tags.hasTag(tag) ||
    event.damageTags?.includes(tag) ||
    false
  );
}

EffectRegistry.getInstance().register(
  'damage_immunity',
  (params) => new DamageImmunityEffect(params),
);
