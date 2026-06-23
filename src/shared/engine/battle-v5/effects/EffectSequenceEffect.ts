import { EffectSequenceParams } from '../core/configs';
import { executeEffectConfigs } from '../core/effectExecutor';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

export class EffectSequenceEffect extends GameplayEffect {
  constructor(private params: EffectSequenceParams) {
    super();
  }

  execute(context: EffectContext): void {
    executeEffectConfigs(this.params.effects, context);
  }
}

EffectRegistry.getInstance().register(
  'effect_sequence',
  (params) => new EffectSequenceEffect(params),
);
