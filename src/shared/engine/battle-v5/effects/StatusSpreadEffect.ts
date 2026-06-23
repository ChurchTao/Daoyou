import { StatusSpreadParams } from '../core/configs';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';
import { publishMechanicLog } from './advancedEffectUtils';

export class StatusSpreadEffect extends GameplayEffect {
  constructor(private params: StatusSpreadParams) {
    super();
  }

  execute(context: EffectContext): void {
    void this.params;
    // Current battle-v5 main flow is 1v1. There is no second enemy target to spread to.
    publishMechanicLog({
      mechanic: 'status_spread',
      source: context.caster,
      target: context.target,
      name: '状态扩散',
      detail: 'no_target',
    });
  }
}

EffectRegistry.getInstance().register(
  'status_spread',
  (params) => new StatusSpreadEffect(params),
);
