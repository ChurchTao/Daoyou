import type { CharacterManualDefV1 } from './types';

/** valueAt1 is the complete first-level bonus; growth starts at level two. */
export function manualAttributeValue(
  effect: CharacterManualDefV1['effects'][number],
  level: number,
): number {
  return effect.valueAt1 + effect.valuePerLevel * (level - 1);
}
