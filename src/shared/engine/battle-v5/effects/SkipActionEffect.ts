import type { SkipActionParams } from '../core/configs';
import { queueSkippedActions } from '../core/runtimeState';
import { EventBus } from '../core/EventBus';
import type { ActionStateEvent } from '../core/events';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

export class SkipActionEffect extends GameplayEffect {
  constructor(private readonly params: SkipActionParams) {
    super();
  }

  execute(context: EffectContext): void {
    const count = this.params.count ?? 1;
    const name = this.params.name ?? '调息';
    const sourceAbility = context.ability
      ? { id: context.ability.id, name: context.ability.name }
      : undefined;
    queueSkippedActions(
      context.caster,
      count,
      this.params.reason,
      name,
      sourceAbility,
    );
    EventBus.instance.publish<ActionStateEvent>({
      type: 'ActionStateEvent',
      timestamp: Date.now(),
      unit: context.caster,
      stateType: 'rest',
      phase: 'entered',
      name,
      remainingActions: count,
      sourceAbility,
      reason: this.params.reason,
    });
  }
}

EffectRegistry.getInstance().register('skip_action', (params) => new SkipActionEffect(params));
