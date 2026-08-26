import { DamageImmunityParams } from '../core/configs';
import { DamageSegmentRequestedEvent, DamageImmuneEvent } from '../core/events';
import { DamageType } from '../core/types';
import { EffectRegistry } from '../factories/EffectRegistry';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';

/**
 * 伤害免疫原子效果
 */
export class DamageImmunityEffect extends GameplayEffect {
  constructor(private readonly params: DamageImmunityParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const { triggerEvent, target } = context;
    if (!triggerEvent || triggerEvent.type !== 'DamageSegmentRequestedEvent') {
      return;
    }

    const event = triggerEvent as DamageSegmentRequestedEvent;
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

    context.commit(target, {
      type: 'defense',
      defense: 'damage_immune',
      amount: Math.round(blockedDamage),
    });

    context.emit<DamageImmuneEvent>({
      type: 'DamageImmuneEvent',
      timestamp: context.owner.runtime.clock.now(),
      caster: event.caster,
      target,
      ability: event.ability,
      buff: event.buff,
      blockedDamage,
      matchedTag,
    });
  }
}

function matchesDamageTag(event: DamageSegmentRequestedEvent, tag: string): boolean {
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
