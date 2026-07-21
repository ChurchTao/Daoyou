import type { LifestealParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import type { DamageTakenEvent, HealEvent } from '../core/events';
import { claimActionAmount } from '../core/runtimeState';
import { DamageSource } from '../core/types';
import { EffectRegistry } from '../factories/EffectRegistry';
import type { EffectContext } from './Effect';
import { GameplayEffect } from './Effect';

export class LifestealEffect extends GameplayEffect {
  constructor(private readonly params: LifestealParams) {
    super();
  }

  execute(context: EffectContext): void {
    if (context.triggerEvent?.type !== 'DamageTakenEvent') return;
    const event = context.triggerEvent as DamageTakenEvent;
    if (event.caster !== context.caster || event.damageSource !== DamageSource.DIRECT) return;
    const requested = Math.round(event.damageTaken * this.params.ratio);
    const amount = claimActionAmount(
      context.caster,
      'lifesteal',
      requested,
      Math.round(context.caster.getMaxHp() * this.params.maxHpRatioPerAction),
    );
    if (amount <= 0) return;
    const appliedAmount = context.caster.heal(amount);
    EventBus.instance.publish<HealEvent>({
      type: 'HealEvent',
      timestamp: Date.now(),
      caster: context.caster,
      target: context.caster,
      ability: event.ability,
      healAmount: amount,
      appliedAmount,
      healType: 'hp',
    });
  }
}

EffectRegistry.getInstance().register('lifesteal', (params) => new LifestealEffect(params));
