import { REALM_ORDER, type RealmType } from '../../../types/constants';
import { WILD_REGIONS } from '../wild/content';
import { BEAST_SPECIES } from './content';
import type { BeastSpeciesDefinition } from './pack';

export interface BeastCodexHabitat {
  nodeId: string;
  name: string;
  realmRequirement: RealmType;
  minLevel: number;
  maxLevel: number;
}

export interface BeastCodexSkill {
  id: string;
  innate: 'core' | 'candidate';
}

export interface BeastCodexEntry {
  id: string;
  name: string;
  realm: RealmType;
  carryLevel: number;
  description: string;
  starter: boolean;
  aptitudes: BeastSpeciesDefinition['aptitudes'];
  growthMilli: BeastSpeciesDefinition['growthMilli'];
  skills: BeastCodexSkill[];
  habitats: BeastCodexHabitat[];
}

/** 图鉴展示物种普通上限：资质与成长取区间上界，技能为全部天生技能。 */
export function listBeastCodex(
  species: readonly BeastSpeciesDefinition[] = BEAST_SPECIES,
  regions: readonly (typeof WILD_REGIONS)[number][] = WILD_REGIONS,
): BeastCodexEntry[] {
  return species.map((entry) => ({
    id: entry.id,
    name: entry.name,
    realm: entry.realm,
    carryLevel: entry.carryLevel,
    description: entry.description,
    starter: entry.starter,
    aptitudes: entry.aptitudes,
    growthMilli: entry.growthMilli,
    skills: [
      ...entry.birthSkills.core.map((id): BeastCodexSkill => ({
        id,
        innate: 'core',
      })),
      ...entry.birthSkills.candidates.map((id): BeastCodexSkill => ({
        id,
        innate: 'candidate',
      })),
    ],
    habitats: regions
      .flatMap((region) =>
        region.species
          .filter((row) => row.speciesId === entry.id)
          .map((row) => ({
            nodeId: region.nodeId,
            name: region.name,
            realmRequirement: region.realmRequirement,
            minLevel: row.minLevel,
            maxLevel: row.maxLevel,
          })),
      )
      .sort(
        (a, b) =>
          REALM_ORDER[a.realmRequirement] - REALM_ORDER[b.realmRequirement] ||
          a.minLevel - b.minLevel ||
          a.name.localeCompare(b.name, 'zh'),
      ),
  }));
}
