import { TurnStateCounterParams } from '../core/configs';
import { executeEffectConfigs } from '../core/effectExecutor';
import { DamageTakenEvent } from '../core/events';
import {
  consumeDamageDealtFlag,
  getBattleRuntimeState,
} from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

export class TurnStateCounterEffect extends GameplayEffect {
  constructor(private params: TurnStateCounterParams) {
    super();
  }

  execute(context: EffectContext): void {
    const state = getBattleRuntimeState(context.caster);
    if (this.params.event === 'no_damage_dealt') {
      if (consumeDamageDealtFlag(context.caster)) {
        state.counters.delete(this.params.key);
        return;
      }
    } else if (
      context.triggerEvent &&
      context.triggerEvent.type === 'DamageTakenEvent' &&
      (context.triggerEvent as DamageTakenEvent).caster !== context.caster
    ) {
      return;
    }
    const next = (state.counters.get(this.params.key) ?? 0) + 1;
    state.counters.set(this.params.key, next);
    if (next < this.params.threshold) return;

    executeEffectConfigs(this.params.effects, context);
    if (this.params.resetOnTrigger !== false) {
      state.counters.delete(this.params.key);
    }
  }
}

EffectRegistry.getInstance().register(
  'turn_state_counter',
  (params) => new TurnStateCounterEffect(params),
);
