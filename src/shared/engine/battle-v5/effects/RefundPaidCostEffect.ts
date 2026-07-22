import type { RefundPaidCostParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import type { HealEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/** 按本次施法快照中的实际支付法力返还资源。 */
export class RefundPaidCostEffect extends GameplayEffect {
  constructor(private readonly params: RefundPaidCostParams) {
    super();
  }

  execute(context: EffectContext): void {
    const snapshot = context.castSnapshot;
    if (!snapshot || (this.params.resource ?? 'mp') !== 'mp') return;
    const paid = Math.max(
      0,
      snapshot.casterMpBeforeCost - snapshot.casterMpAfterCost,
    );
    const requested = Math.round(paid * Math.max(0, this.params.ratio));
    if (requested <= 0) return;

    const applied = context.caster.restoreMp(requested);
    EventBus.instance.publish<HealEvent>({
      type: 'HealEvent',
      timestamp: Date.now(),
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
