import { DynamicScalarParams } from '../core/configs';
import { DamageRequestEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

export class DynamicScalarEffect extends GameplayEffect {
  constructor(private params: DynamicScalarParams) {
    super();
  }

  execute(context: EffectContext): void {
    if (!context.triggerEvent || context.triggerEvent.type !== 'DamageRequestEvent') {
      return;
    }
    const event = context.triggerEvent as DamageRequestEvent;
    const unit = this.params.mode === 'increase' ? context.caster : context.target;
    const percent =
      this.params.resource === 'hp' ? unit.getHpPercent() : unit.getMpPercent();
    const rawScalar = this.params.lowerIsStronger ? 1 - percent : percent;
    const scalar = Math.min(
      this.params.cap ?? Number.POSITIVE_INFINITY,
      rawScalar * this.params.value,
    );
    if (this.params.mode === 'increase') {
      event.damageIncreasePctBucket = (event.damageIncreasePctBucket ?? 0) + scalar;
    } else {
      event.damageReductionPctBucket = (event.damageReductionPctBucket ?? 0) + scalar;
    }
  }
}

EffectRegistry.getInstance().register(
  'dynamic_scalar',
  (params) => new DynamicScalarEffect(params),
);
