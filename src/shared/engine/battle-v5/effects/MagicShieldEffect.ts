import { MagicShieldParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { DamageEvent, ManaShieldAbsorbEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 魔法盾原子效果
 * 以 MP 换取伤害吸收，不占用实体护盾池。
 */
export class MagicShieldEffect extends GameplayEffect {
  constructor(private readonly params: MagicShieldParams = {}) {
    super();
  }

  execute(context: EffectContext): void {
    const { triggerEvent } = context;
    if (!triggerEvent || triggerEvent.type !== 'DamageEvent') {
      return;
    }

    const damageEvent = triggerEvent as DamageEvent;
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

    EventBus.instance.publish<ManaShieldAbsorbEvent>({
      type: 'ManaShieldAbsorbEvent',
      timestamp: Date.now(),
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