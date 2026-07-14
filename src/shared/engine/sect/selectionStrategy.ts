import type { AbilitySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type { SectCombatProjection } from './types';

export * from './content/lingxiao/strategy/heavy';
export * from './content/lingxiao/strategy/swift';

/** Generic adapter used by battle-v5; tactic choice remains path-owned. */
export function createSectAbilitySelectionStrategy(
  projection: SectCombatProjection,
): AbilitySelectionStrategy | null {
  return projection.selectionStrategy ?? null;
}
