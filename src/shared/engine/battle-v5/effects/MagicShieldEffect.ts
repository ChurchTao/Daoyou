import { MagicShieldParams } from '../core/configs';
import { DamageSegmentRequestedEvent, ManaShieldAbsorbEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';

/**
 * 魔法盾原子效果
 * 以法力换取伤害吸收，不占用实体护盾池。
 */
export class MagicShieldEffect extends GameplayEffect {
  constructor(private readonly params: MagicShieldParams = {}) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const { triggerEvent } = context;
    if (!triggerEvent || triggerEvent.type !== 'DamageSegmentRequestedEvent') {
      return;
    }

    const damageEvent = triggerEvent as DamageSegmentRequestedEvent;
    if (damageEvent.finalDamage <= 0) {
      return;
    }

    const absorbRatio = Math.max(
      0,
      Math.min(1, this.params.absorbRatio ?? 0.98),
    );
    const maxAbsorbableDamage = Math.floor(damageEvent.finalDamage * absorbRatio);
    if (maxAbsorbableDamage <= 0) {
      return;
    }

    const mpConsumed = damageEvent.target.takeMp(maxAbsorbableDamage);
    if (mpConsumed <= 0) {
      return;
    }

    damageEvent.finalDamage = Math.max(0, damageEvent.finalDamage - mpConsumed);

    context.commit(damageEvent.target, {
      type: 'defense',
      defense: 'mana_shield',
      amount: Math.round(mpConsumed),
      detail: `消耗${Math.round(mpConsumed)}点法力`,
    });

    context.emit<ManaShieldAbsorbEvent>({
      type: 'ManaShieldAbsorbEvent',
      timestamp: context.owner.runtime.clock.now(),
      caster: damageEvent.caster,
      target: damageEvent.target,
      ability: damageEvent.ability,
      buff: damageEvent.buff,
      absorbedDamage: mpConsumed,
      mpConsumed,
      remainDamage: damageEvent.finalDamage,
    });
  }
}

EffectRegistry.getInstance().register(
  'magic_shield',
  (params) => new MagicShieldEffect(params),
);
