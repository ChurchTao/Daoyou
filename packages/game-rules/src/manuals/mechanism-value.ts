import type { ManualMechanism } from '@daoyou/game-domain/manuals/authoring';

/** Numeric presentation stays independent of the battle/content compiler. */
export function manualMechanismValue(mechanism: ManualMechanism, level: number): number {
  return Number((
    mechanism.valueAt1 + ((mechanism.valueAt9 - mechanism.valueAt1) * (level - 1)) / 8
  ).toFixed(8));
}
