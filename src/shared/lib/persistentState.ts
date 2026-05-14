import type { CultivatorPersistentState } from '@shared/types/cultivator';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getBreakthroughPenalty(
  stateInput: CultivatorPersistentState | undefined,
): number {
  const pillToxicity = Math.max(0, stateInput?.pillToxicity ?? 0);
  return clamp(pillToxicity / 1000, 0, 0.18);
}
