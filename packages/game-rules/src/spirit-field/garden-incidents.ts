import {
  SPIRIT_GARDEN_BEAST_RECOVERY_MS,
  SPIRIT_GARDEN_INCIDENT_CHANCE,
  SPIRIT_GARDEN_INCIDENT_INTERVAL_MS,
  SPIRIT_GARDEN_PEST_RECOVERY_MS,
  SPIRIT_GARDEN_SPECIES,
} from '@daoyou/game-content/spirit-field/config';
import type {
  SpiritGardenIncidentKind,
  SpiritGardenPlant,
} from '@daoyou/game-domain/spirit-field';

/** A plant's server-issued identity fixes every production day's draws. */
function incidentDraw(plantId: string, day: number, purpose: string): number {
  const key = `${plantId}:${day}:${purpose}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < key.length; index += 1)
    hash = Math.imul(hash ^ key.charCodeAt(index), 16_777_619);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4_294_967_296;
}

export function isSpiritGardenMutated(plant: SpiritGardenPlant): boolean {
  return plant.incidents.some((incident) => incident.kind === 'mutation');
}

/** Rate in tenths, so splitting settlement into millisecond reads is exact. */
export function spiritGardenProductionRate(plant: SpiritGardenPlant): number {
  return isSpiritGardenMutated(plant) ? 11 : 10;
}

export function recordSpiritGardenIncident(
  plant: SpiritGardenPlant,
  occurredAt: number,
): SpiritGardenPlant {
  const day = plant.productionClockMs / SPIRIT_GARDEN_INCIDENT_INTERVAL_MS;
  if (
    incidentDraw(plant.id, day, 'occurrence') >= SPIRIT_GARDEN_INCIDENT_CHANCE
  )
    return plant;
  const kindRoll = incidentDraw(plant.id, day, 'kind');
  const kind: SpiritGardenIncidentKind =
    kindRoll < 0.45 ? 'pests' : kindRoll < 0.9 ? 'beast' : 'mutation';
  if (kind === 'mutation' && isSpiritGardenMutated(plant)) return plant;
  if (
    kind !== 'mutation' &&
    plant.incidents.filter((incident) => incident.kind !== 'mutation').length >=
      2
  )
    return plant;

  let seedSpeciesId: string | null = null;
  if (
    kind === 'beast' &&
    !plant.incidents.some((incident) => incident.seedSpeciesId !== null) &&
    incidentDraw(plant.id, day, 'seed') < 0.1
  ) {
    // Four species per quality make a uniform catalog draw uniform across all eight qualities.
    const candidates = SPIRIT_GARDEN_SPECIES;
    seedSpeciesId =
      candidates[
        Math.floor(incidentDraw(plant.id, day, 'species') * candidates.length)
      ]!.id;
  }
  return {
    ...plant,
    incidents: [
      ...plant.incidents,
      { kind, productionDay: day, occurredAt, seedSpeciesId },
    ],
    recoveryRemainingMs:
      kind === 'pests'
        ? SPIRIT_GARDEN_PEST_RECOVERY_MS
        : kind === 'beast'
          ? SPIRIT_GARDEN_BEAST_RECOVERY_MS
          : 0,
    pendingSeedSpeciesId: seedSpeciesId ?? plant.pendingSeedSpeciesId,
  };
}
