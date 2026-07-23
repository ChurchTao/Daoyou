import { AttributeType, DamageSource, DamageType } from '../core/types';
import { DamageDeferParams } from '../core/configs';
import { DamageEvent } from '../core/events';
import { nextRuntimeSequence, rememberAmount } from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { EffectContext, GameplayEffect } from './Effect';
import { DelayedRuntimeBuff } from './DelayedEffect';
import { publishMechanicLog } from './advancedEffectUtils';
import { ValueCalculator } from '../core/ValueCalculator';

export class DamageDeferEffect extends GameplayEffect {
  constructor(private params: DamageDeferParams) {
    super();
  }

  execute(context: EffectContext): void {
    if (!context.triggerEvent || context.triggerEvent.type !== 'DamageEvent') {
      return;
    }
    const event = context.triggerEvent as DamageEvent;
    if (
      this.params.thresholdMaxHpRatio !== undefined &&
      event.finalDamage < event.target.getMaxHp() * this.params.thresholdMaxHpRatio
    ) {
      return;
    }

    const deferred = Math.round(event.finalDamage * this.params.ratio);
    if (deferred <= 0) return;
    event.finalDamage = Math.max(0, event.finalDamage - deferred);
    if (this.params.memory) {
      const cap = this.params.memory.maxStoredValue
        ? ValueCalculator.calculate(
            this.params.memory.maxStoredValue,
            context.caster,
            event.target,
          )
        : Number.POSITIVE_INFINITY;
      rememberAmount(event.target, this.params.memory.key, deferred, cap);
    }
    publishMechanicLog({
      mechanic: 'damage_defer',
      source: event.caster,
      ability: event.ability,
      target: event.target,
      name: '延迟伤害',
      displayName: '延迟伤害',
      visibility: 'player',
      value: deferred,
      detail: `${this.params.delayTurns}`,
    });

    event.target.buffs.addBuff(
      new DelayedRuntimeBuff({
        id: `deferred_damage_${nextRuntimeSequence(event.target, 'damage_defer')}`,
        name: '延迟伤害',
        description: `${this.params.delayTurns}回合后结算被太虚袍延后的伤害。`,
        delayTurns: this.params.delayTurns,
        effects: [
          {
            type: 'damage',
            params: {
              value: { base: deferred, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
              damageType: event.damageType ?? DamageType.TRUE,
              damageSource: DamageSource.DELAYED,
            },
          },
        ],
        tags: [GameplayTags.BUFF.TYPE.DEBUFF],
      }),
      event.caster,
    );
  }
}

EffectRegistry.getInstance().register(
  'damage_defer',
  (params) => new DamageDeferEffect(params),
);
