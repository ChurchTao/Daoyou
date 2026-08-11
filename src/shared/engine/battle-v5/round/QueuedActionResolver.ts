import { ActiveSkill } from '../abilities/ActiveSkill';
import { peekQueuedAction } from '../core/runtimeState';
import { AbilityFactory } from '../factories/AbilityFactory';
import { TargetSelectionSystem } from '../systems/TargetSelectionSystem';
import type { Unit } from '../units/Unit';

export interface LegalQueuedActionV1 {
  ability: ActiveSkill;
  target: Unit;
  legalTargets: Unit[];
}

/**
 * Resolves a queued action against the immutable planning checkpoint.
 * Queued actions are mandatory and already paid for, so only target legality
 * is evaluated here; ordinary cooldown, resource and cast conditions do not
 * get a second chance to cancel the release.
 */
export function resolveLegalQueuedAction(
  actor: Unit,
  allUnits: Unit[],
  preferredTargetId?: string,
): LegalQueuedActionV1 | null {
  const queued = peekQueuedAction(actor);
  if (!queued) return null;
  const ability = AbilityFactory.create(queued.ability);
  if (!(ability instanceof ActiveSkill)) return null;
  const legalTargets = new TargetSelectionSystem().getTargetCandidates(
    actor,
    ability.targetPolicy,
    allUnits,
  );
  const target =
    legalTargets.find((candidate) => candidate.id === preferredTargetId) ??
    legalTargets[0];
  return target ? { ability, target, legalTargets } : null;
}
