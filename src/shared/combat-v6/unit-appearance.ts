import type { CombatV6UnitAppearance } from '../contracts/combatV6';
import { BEAST_SPECIES } from '../engine/combat-v6/beasts/content';
import type { CreateBattleInput } from '../engine/combat-v6/core';
import type { CombatV6TrainingPlayerInput } from '../engine/combat-v6/encounter/types';

/** Frozen presentation facts belong to the host, never to combat calculations. */
export type PresentedBattleInput = Omit<CreateBattleInput, 'ruleset'> & {
  unitAppearances?: Record<string, CombatV6UnitAppearance>;
};

export function beastAppearance(speciesId: string): CombatV6UnitAppearance {
  const species = BEAST_SPECIES.find((entry) => entry.id === speciesId);
  return { icon: species?.icon ?? '🐾', speciesName: species?.name };
}

export function playerAppearances(
  player: CombatV6TrainingPlayerInput,
): Record<string, CombatV6UnitAppearance> {
  return {
    [player.cultivator.id]: {
      icon: player.portrait ?? 'icon:cultivator-male-avatar',
    },
    ...Object.fromEntries(
      (player.beasts?.beasts ?? []).map((beast) => [
        `beast:${beast.id}`,
        beastAppearance(beast.speciesId),
      ]),
    ),
  };
}

/** Apply the same visibility boundary as names, including hidden opponent reserves. */
export function publicUnitAppearances(
  appearances: Record<string, CombatV6UnitAppearance> | undefined,
  names: Record<string, string>,
) {
  return Object.fromEntries(
    Object.entries(appearances ?? {}).filter(([id]) =>
      Object.prototype.hasOwnProperty.call(names, id),
    ),
  );
}
