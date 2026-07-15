import { DamageMemoryParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import {
  DamageRequestEvent,
  DamageTakenEvent,
  HealEvent,
  ShieldBreakEvent,
  ShieldEvent,
} from '../core/events';
import { clearMemory, readMemory, rememberAmount } from '../core/runtimeState';
import { DamageSource, DamageType } from '../core/types';
import { ValueCalculator } from '../core/ValueCalculator';
import { EffectRegistry } from '../factories/EffectRegistry';
import { publishMechanicLog } from './advancedEffectUtils';
import { EffectContext, GameplayEffect } from './Effect';

export class DamageMemoryEffect extends GameplayEffect {
  constructor(private params: DamageMemoryParams) {
    super();
  }

  execute(context: EffectContext): void {
    const owner =
      this.params.target === 'target' ? context.target : context.caster;
    if (this.params.mode === 'clear') {
      clearMemory(owner, this.params.key);
      return;
    }

    if (this.params.mode === 'record') {
      const amount = this.getRecordAmount(context);
      if (amount > 0) {
        rememberAmount(
          owner,
          this.params.key,
          amount,
          this.resolveMaxStored(context, owner),
        );
        publishMechanicLog({
          mechanic: 'memory_record',
          source: context.caster,
          target: owner,
          name: this.params.key,
          value: amount,
        });
      }
      return;
    }

    const memory = readMemory(owner, this.params.key);
    const sourceAmount =
      memory.amount > 0 ? memory.amount : this.getRecordAmount(context);
    const amount = Math.round(sourceAmount * (this.params.ratio ?? 1));
    if (amount <= 0) return;

    switch (this.params.releaseAs ?? 'damage') {
      case 'heal':
        context.target.heal(amount);
        EventBus.instance.publish<HealEvent>({
          type: 'HealEvent',
          timestamp: Date.now(),
          caster: context.caster,
          target: context.target,
          ability: context.ability,
          buff: context.buff,
          healAmount: amount,
          healType: 'hp',
        });
        break;
      case 'shield':
        context.target.addShield(amount);
        EventBus.instance.publish<ShieldEvent>({
          type: 'ShieldEvent',
          timestamp: Date.now(),
          caster: context.caster,
          target: context.target,
          ability: context.ability,
          shieldAmount: amount,
        });
        break;
      case 'reflect':
        if (context.triggerEvent?.type === 'DamageTakenEvent') {
          const attacker = (context.triggerEvent as DamageTakenEvent).caster;
          if (attacker?.isAlive()) {
            this.publishDamage(
              context.target,
              attacker,
              amount,
              DamageSource.REFLECT,
            );
          }
        }
        break;
      case 'counter':
        this.publishDamage(context.caster, context.target, amount, DamageSource.COUNTER);
        break;
      case 'follow_up':
        this.publishDamage(context.caster, context.target, amount, DamageSource.FOLLOW_UP);
        break;
      case 'damage':
      default:
        this.publishDamage(
          context.caster,
          context.target,
          amount,
          DamageSource.DIRECT,
        );
        break;
    }

    publishMechanicLog({
      mechanic: 'memory_release',
      source: context.caster,
      target: context.target,
      name: this.params.key,
      value: amount,
      detail: this.params.releaseAs ?? 'damage',
    });

    if (this.params.consume !== false) {
      clearMemory(owner, this.params.key);
    }
  }

  private publishDamage(
    caster: EffectContext['caster'],
    target: EffectContext['target'],
    amount: number,
    damageSource: DamageSource,
  ): void {
    EventBus.instance.publish<DamageRequestEvent>({
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster,
      target,
      damageSource,
      damageType:
        damageSource === DamageSource.COUNTER ||
        damageSource === DamageSource.FOLLOW_UP
          ? DamageType.PHYSICAL
          : DamageType.TRUE,
      damageComponents: [
        {
          kind: 'memory',
          amount,
          mitigation:
            damageSource === DamageSource.COUNTER ||
            damageSource === DamageSource.FOLLOW_UP
              ? 'normal'
              : 'bypass_defense',
          defenseScale: 1,
        },
      ],
      baseDamage: amount,
      finalDamage: amount,
    });
  }

  private getRecordAmount(context: EffectContext): number {
    const event = context.triggerEvent;
    if (!event) return 0;
    if (this.params.event === 'heal' && event.type === 'HealEvent') {
      return (event as HealEvent).healAmount;
    }
    if (this.params.event === 'shield' && event.type === 'ShieldEvent') {
      return (event as ShieldEvent).shieldAmount;
    }
    if (
      this.params.event === 'shield_break' &&
      event.type === 'ShieldBreakEvent'
    ) {
      return (event as ShieldBreakEvent).brokenShieldAmount;
    }
    if (event.type !== 'DamageTakenEvent') return 0;
    const damageEvent = event as DamageTakenEvent;
    if (this.params.event === 'shield_absorbed') {
      return damageEvent.shieldAbsorbed ?? 0;
    }
    if (this.params.event === 'critical_taken' && !damageEvent.isCritical) {
      return 0;
    }
    if (
      this.params.event === 'damage_dealt' &&
      damageEvent.caster !== context.caster
    ) {
      return 0;
    }
    if (
      (this.params.event === 'damage_taken' ||
        this.params.event === 'critical_taken') &&
      damageEvent.target !== context.target
    ) {
      return 0;
    }
    return (
      damageEvent.damageTaken +
      (this.params.includeShieldAbsorbed
        ? (damageEvent.shieldAbsorbed ?? 0)
        : 0)
    );
  }

  private resolveMaxStored(
    context: EffectContext,
    owner: EffectContext['target'],
  ): number | undefined {
    if (this.params.maxStoredValue) {
      const valueCap = ValueCalculator.calculate(
        this.params.maxStoredValue,
        context.caster,
        owner,
      );
      if (this.params.maxStored !== undefined) {
        return Math.min(this.params.maxStored, valueCap);
      }
      return valueCap;
    }
    return this.params.maxStored;
  }
}

EffectRegistry.getInstance().register(
  'damage_memory',
  (params) => new DamageMemoryEffect(params),
);
