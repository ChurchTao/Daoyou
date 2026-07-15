import type { SkipActionParams } from '../core/configs';
import { queueSkippedActions } from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

export class SkipActionEffect extends GameplayEffect {
  constructor(private readonly params: SkipActionParams) {
    super();
  }

  execute(context: EffectContext): void {
    queueSkippedActions(context.caster, this.params.count ?? 1, this.params.reason);
  }
}

EffectRegistry.getInstance().register('skip_action', (params) => new SkipActionEffect(params));
