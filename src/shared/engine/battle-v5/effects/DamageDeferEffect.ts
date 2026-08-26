import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { ValueCalculator } from '../core/ValueCalculator';
import { DamageDeferParams } from '../core/configs';
import { DamageSegmentRequestedEvent } from '../core/events';
import { nextRuntimeSequence, rememberAmount } from '../core/runtimeState';
import { AttributeType, DamageSource, DamageType } from '../core/types';
import { EffectRegistry } from '../factories/EffectRegistry';
import { CombatMechanicCodeV3 } from '../v3/mechanics';
import { CombatAttributionV3 } from '../v3/origin';
import { DelayedRuntimeBuff } from './DelayedEffect';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';
import { commitMechanicResultV3 } from './advancedEffectUtils';

export class DamageDeferEffect extends GameplayEffect {
  constructor(private params: DamageDeferParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    if (!context.triggerEvent || context.triggerEvent.type !== 'DamageSegmentRequestedEvent') {
      return;
    }
    const event = context.triggerEvent as DamageSegmentRequestedEvent;
    if (
      this.params.thresholdMaxHpRatio !== undefined &&
      event.finalDamage <
        event.target.getMaxHp() * this.params.thresholdMaxHpRatio
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
    commitMechanicResultV3(context, {
      code: CombatMechanicCodeV3.DAMAGE_DEFER,
      target: event.target,
      visibility: 'player',
      payload: {
        kind: 'damage_defer',
        amount: deferred,
        turns: this.params.delayTurns,
      },
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
              value: {
                base: deferred,
                attribute: AttributeType.MAGIC_ATK,
                coefficient: 0,
              },
              damageType: event.damageType ?? DamageType.TRUE,
              damageSource: DamageSource.DELAYED,
            },
          },
        ],
        tags: [GameplayTags.BUFF.TYPE.DEBUFF],
      }),
      event.caster,
      {
        ability: context.ability,
        buff: context.buff,
        attribution: CombatAttributionV3.rebind(context.owner, context.origin),
      trace: context.trace,
      resolution: context.resolution,
      },
    );
  }
}

EffectRegistry.getInstance().register(
  'damage_defer',
  (params) => new DamageDeferEffect(params),
);
