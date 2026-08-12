import { ActiveSkill } from '../abilities/ActiveSkill';
import { TargetSelectionSystem } from '../systems/TargetSelectionSystem';
import type { Unit } from '../units/Unit';
import { GameplayTags } from '../../shared/tag-domain';

export interface LegalBasicAttackV1 {
  ability: ActiveSkill;
  target: Unit;
  legalTargets: Unit[];
}

/** Resolves the configured attack, falling back to the engine basic attack. */
export function resolveLegalBasicAttack(
  actor: Unit,
  allUnits: Unit[],
  preferredTargetId?: string,
): LegalBasicAttackV1 | null {
  if (actor.tags.hasTag(GameplayTags.STATUS.CONTROL.NO_BASIC)) return null;
  const targetSystem = new TargetSelectionSystem();
  const configured = actor.abilities.getDefaultAttack();
  const configuredSelection = select(configured, actor, allUnits, preferredTargetId, targetSystem);
  if (configuredSelection) return configuredSelection;
  const fallback = actor.abilities.getFallbackBasicAttack();
  return select(fallback, actor, allUnits, preferredTargetId, targetSystem);
}

function select(
  ability: unknown,
  actor: Unit,
  allUnits: Unit[],
  preferredTargetId: string | undefined,
  targetSystem: TargetSelectionSystem,
): LegalBasicAttackV1 | null {
  if (!(ability instanceof ActiveSkill)) return null;
  const candidates = targetSystem.getTargetCandidates(
    actor,
    ability.targetPolicy,
    allUnits,
  );
  const legalTargets = candidates.filter((target) =>
    ability.canTrigger({ caster: actor, target }),
  );
  const target =
    legalTargets.find((candidate) => candidate.id === preferredTargetId) ??
    legalTargets[0];
  return target ? { ability, target, legalTargets } : null;
}
