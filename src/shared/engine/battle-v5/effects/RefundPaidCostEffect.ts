import type { RefundPaidCostParams } from '../core/configs';
import type { HealEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';

/** 按本次施法快照中的实际支付法力返还资源。 */
export class RefundPaidCostEffect extends GameplayEffect {
  constructor(private readonly params: RefundPaidCostParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const snapshot = context.castSnapshot;
    if (!snapshot || (this.params.resource ?? 'mp') !== 'mp') return;
    const paid = Math.max(
      0,
      snapshot.casterMpBeforeCost - snapshot.casterMpAfterCost,
    );
    const requested =
      'amount' in this.params && typeof this.params.amount === 'number'
        ? Math.min(paid, Math.round(Math.max(0, this.params.amount)))
        : Math.round(paid * Math.max(0, this.params.ratio));
    if (requested <= 0) return;

    const applied = context.caster.restoreMp(requested);
    if (applied > 0) {
      context.commit(context.caster, {
        type: 'recovery',
        resource: 'mp',
        amount: Math.round(applied),
        after: Math.round(context.caster.getCurrentMp()),
      });
    }
    context.emit<HealEvent>({
      type: 'HealEvent',
      timestamp: context.owner.runtime.clock.now(),
      caster: context.caster,
      target: context.caster,
      ability: context.ability,
      buff: context.buff,
      healAmount: requested,
      appliedAmount: applied,
      healType: 'mp',
    });
  }
}

EffectRegistry.getInstance().register(
  'refund_paid_cost',
  (params) => new RefundPaidCostEffect(params),
);
