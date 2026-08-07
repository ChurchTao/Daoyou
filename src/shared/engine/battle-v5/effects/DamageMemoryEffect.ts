import { DamageMemoryParams } from '../core/configs';
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
import { commitMechanicResultV3 } from './advancedEffectUtils';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';

export class DamageMemoryEffect extends GameplayEffect {
  constructor(private params: DamageMemoryParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const owner =
      this.params.target === 'target' ? context.target : context.caster;
    if (this.params.mode === 'clear') {
      clearMemory(owner, this.params.key);
      return;
    }

    if (this.params.mode === 'record') {
      const amount = this.getRecordAmount(context);
      if (amount > 0) {
        const stored = rememberAmount(
          owner,
          this.params.key,
          amount,
          this.resolveMaxStored(context, owner),
        );
        commitMechanicResultV3(context, {
          code: this.params.key,
          target: owner,
          payload: {
            kind: 'memory_record',
            source: this.params.event ?? 'damage_taken',
            sampledAmount: amount,
            before: stored.before,
            after: stored.after,
          },
        });
      }
      return;
    }

    const memory = readMemory(owner, this.params.key);
    const storedAmount =
      memory.amount > 0 ? memory.amount : this.getRecordAmount(context);
    const amount = Math.round(storedAmount * (this.params.ratio ?? 1));
    if (amount <= 0) return;
    const narrativeContext = context.withNarrativeCause();

    switch (this.params.releaseAs ?? 'damage') {
      case 'heal': {
        const appliedAmount = narrativeContext.target.heal(amount);
        if (appliedAmount > 0) {
          narrativeContext.commit(narrativeContext.target, {
            type: 'recovery',
            resource: 'hp',
            amount: Math.round(appliedAmount),
            after: Math.round(narrativeContext.target.getCurrentHp()),
          });
        }
        narrativeContext.emit<HealEvent>({
          type: 'HealEvent',
          timestamp: context.owner.runtime.clock.now(),
          caster: context.caster,
          target: context.target,
          ability: context.ability,
          buff: context.buff,
          healAmount: amount,
          appliedAmount,
          healType: 'hp',
        });
        break;
      }
      case 'shield': {
        const beforeShield = narrativeContext.target.getCurrentShield();
        narrativeContext.target.addShield(amount);
        const appliedShield =
          narrativeContext.target.getCurrentShield() - beforeShield;
        if (appliedShield > 0) {
          narrativeContext.commit(narrativeContext.target, {
            type: 'shield',
            amount: Math.round(appliedShield),
            after: Math.round(narrativeContext.target.getCurrentShield()),
          });
        }
        narrativeContext.emit<ShieldEvent>({
          type: 'ShieldEvent',
          timestamp: context.owner.runtime.clock.now(),
          caster: context.caster,
          target: context.target,
          ability: context.ability,
          shieldAmount: amount,
        });
        break;
      }
      case 'reflect':
        if (narrativeContext.triggerEvent?.type === 'DamageTakenEvent') {
          const attacker = (narrativeContext.triggerEvent as DamageTakenEvent)
            .caster;
          if (attacker?.isAlive()) {
            this.publishDamage(
              narrativeContext,
              narrativeContext.target,
              attacker,
              amount,
              DamageSource.REFLECT,
            );
          }
        }
        break;
      case 'counter':
        this.publishDamage(
          narrativeContext,
          narrativeContext.caster,
          narrativeContext.target,
          amount,
          DamageSource.COUNTER,
        );
        break;
      case 'follow_up':
        this.publishDamage(
          narrativeContext,
          narrativeContext.caster,
          narrativeContext.target,
          amount,
          DamageSource.FOLLOW_UP,
        );
        break;
      case 'resolved_follow_up':
        this.publishDamage(
          narrativeContext,
          narrativeContext.caster,
          narrativeContext.target,
          amount,
          DamageSource.FOLLOW_UP,
          true,
        );
        break;
      case 'damage':
      default:
        this.publishDamage(
          narrativeContext,
          narrativeContext.caster,
          narrativeContext.target,
          amount,
          DamageSource.DIRECT,
        );
        break;
    }

    narrativeContext.commitCue(narrativeContext.target, {
      type: 'mechanic',
      code: this.params.key,
      payload: {
        kind: 'memory_release',
        amount,
        releaseAs:
          this.params.releaseAs === 'resolved_follow_up'
            ? 'follow_up'
            : (this.params.releaseAs ?? 'damage'),
      },
    });

    if (this.params.consume !== false) {
      clearMemory(owner, this.params.key);
    }
  }

  private publishDamage(
    context: EffectExecutionContextV3,
    caster: EffectExecutionContextV3['caster'],
    target: EffectExecutionContextV3['target'],
    amount: number,
    damageSource: DamageSource,
    resolvedFinal = false,
  ): void {
    if (!target.isAlive()) return;
    context.emit<DamageRequestEvent>({
      type: 'DamageRequestEvent',
      timestamp: context.owner.runtime.clock.now(),
      caster,
      target,
      ability: context.ability,
      buff: context.buff,
      damageSource,
      damageType:
        this.params.damageType ??
        (damageSource === DamageSource.COUNTER ||
        damageSource === DamageSource.FOLLOW_UP
          ? DamageType.PHYSICAL
          : DamageType.TRUE),
      calculationMode: resolvedFinal ? 'resolved_final' : 'standard',
      cause: this.params.cause ?? context.damageCause,
      damageTags: this.params.damageTags,
      damageComponents: [
        {
          kind: 'memory',
          amount,
          mitigation:
            !resolvedFinal &&
            (damageSource === DamageSource.COUNTER ||
              damageSource === DamageSource.FOLLOW_UP)
              ? 'normal'
              : 'bypass_defense',
          ...(!resolvedFinal &&
          (damageSource === DamageSource.COUNTER ||
            damageSource === DamageSource.FOLLOW_UP)
            ? { attackBase: amount, segmentMultiplier: 1 }
            : {}),
        },
      ],
      baseDamage: amount,
      finalDamage: amount,
    });
  }

  private getRecordAmount(context: EffectExecutionContextV3): number {
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
    context: EffectExecutionContextV3,
    owner: EffectExecutionContextV3['target'],
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
