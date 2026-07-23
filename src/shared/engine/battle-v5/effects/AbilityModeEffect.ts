import type { AbilityModeParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import type { ActionStateEvent } from '../core/events';
import {
  advanceAbilityMode,
  clearAbilityMode,
  readAbilityMode,
  setAbilityMode,
} from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import type { EffectContext } from './Effect';
import { GameplayEffect } from './Effect';

export class AbilityModeEffect extends GameplayEffect {
  constructor(private readonly params: AbilityModeParams) {
    super();
  }

  execute(context: EffectContext): void {
    const sourceAbility = context.ability
      ? { id: context.ability.id, name: context.ability.name }
      : undefined;
    const current = readAbilityMode(context.caster, this.params.key);

    if (this.params.operation === 'set') {
      if (!this.params.mode) return;
      const mode = {
        key: this.params.key,
        mode: this.params.mode,
        remainingUses: Math.max(1, Math.trunc(this.params.remainingUses ?? 1)),
        displayName: this.params.displayName ?? this.params.mode,
        cleanupBuffIds: this.params.cleanupBuffIds
          ? [...this.params.cleanupBuffIds]
          : undefined,
      };
      setAbilityMode(context.caster, mode);
      this.publishState(
        context,
        'entered',
        mode.displayName,
        mode.remainingUses,
        sourceAbility,
      );
      return;
    }

    if (!current) return;
    if (this.params.operation === 'advance') {
      const next = advanceAbilityMode(context.caster, this.params.key);
      this.publishState(
        context,
        'triggered',
        current.displayName,
        next?.remainingUses ?? 0,
        sourceAbility,
      );
      return;
    }

    clearAbilityMode(context.caster, this.params.key);
    this.publishState(
      context,
      'cancelled',
      current.displayName,
      0,
      sourceAbility,
    );
  }

  private publishState(
    context: EffectContext,
    phase: ActionStateEvent['phase'],
    name: string,
    remainingActions: number,
    sourceAbility?: { id: string; name: string },
  ): void {
    EventBus.instance.publish<ActionStateEvent>({
      type: 'ActionStateEvent',
      timestamp: Date.now(),
      unit: context.caster,
      stateType: 'ability_mode',
      phase,
      name,
      remainingActions,
      sourceAbility,
    });
  }
}

EffectRegistry.getInstance().register(
  'ability_mode',
  (params) => new AbilityModeEffect(params),
);
