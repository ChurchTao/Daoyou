import type { AbilityModeParams } from '../core/configs';
import {
  advanceAbilityMode,
  clearAbilityMode,
  setAbilityMode,
} from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import { publishMechanicLog } from './advancedEffectUtils';
import type { EffectContext } from './Effect';
import { GameplayEffect } from './Effect';

export class AbilityModeEffect extends GameplayEffect {
  constructor(private readonly params: AbilityModeParams) {
    super();
  }

  execute(context: EffectContext): void {
    if (this.params.operation === 'clear') {
      clearAbilityMode(context.caster, this.params.key);
    } else if (this.params.operation === 'advance') {
      advanceAbilityMode(context.caster, this.params.key, context.ability?.id);
    } else if (this.params.mode) {
      setAbilityMode(context.caster, {
        key: this.params.key,
        mode: this.params.mode,
        phase: Math.max(1, Math.trunc(this.params.phase ?? 1)),
        remainingUses: Math.max(1, Math.trunc(this.params.remainingUses ?? 1)),
        displayName: this.params.displayName ?? this.params.mode,
        cleanupBuffIds: this.params.cleanupBuffIds
          ? [...this.params.cleanupBuffIds]
          : undefined,
      });
    }
    publishMechanicLog({
      mechanic: 'ability_transform',
      source: context.caster,
      target: context.caster,
      ability: context.ability,
      name: this.params.displayName ?? this.params.mode ?? this.params.key,
      displayName: this.params.displayName,
      visibility: 'player',
      detail: this.params.operation,
    });
  }
}

EffectRegistry.getInstance().register(
  'ability_mode',
  (params) => new AbilityModeEffect(params),
);
