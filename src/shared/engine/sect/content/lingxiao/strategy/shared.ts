import type {
  AbilitySelectionCandidate,
  AbilitySelectionResult,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';

const slug = (abilityId: string) => `sect.lingxiao.${abilityId}`;

export function findCandidate(
  candidates: AbilitySelectionCandidate[],
  abilityId: string,
) {
  return candidates.find(
    (candidate) => candidate.ability.id === slug(abilityId),
  );
}

export function selectionResult(
  candidate: AbilitySelectionCandidate | undefined,
  score: number,
): AbilitySelectionResult | null {
  return candidate
    ? { ability: candidate.ability, target: candidate.target, score }
    : null;
}
