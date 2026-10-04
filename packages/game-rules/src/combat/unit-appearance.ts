import type {
  CombatV6UnitAppearance,
  CombatV6TrainingPlayerInput,
} from '@daoyou/game-domain/combat';

import { BEAST_SPECIES } from '@daoyou/game-content/beasts';


export function beastAppearance(
  speciesId: string,
  isMutant = false,
): CombatV6UnitAppearance {
  const species = BEAST_SPECIES.find((entry) => entry.id === speciesId);
  return {
    icon: species?.icon ?? '🐾',
    speciesName: species?.name,
    ...(isMutant ? { isMutant: true } : {}),
  };
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
        beastAppearance(beast.speciesId, beast.isMutant),
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
