import { WILD_PACK } from './pack';
import {
  ATTR_NAMES,
  type Attrs,
  type SkillDef,
} from '../core/index.ts';

export const WILD_CONTENT_VERSION = 'daoyou_wild_encounter_content_v1';
export const WILD_REGION = WILD_PACK.region;
export const WILD_SPECIES = WILD_PACK.species;
export const WILD_SKILLS: SkillDef[] = WILD_PACK.skills;

export function wildPanel(speciesId: string, level: number, pack = WILD_PACK): Attrs {
  const row = pack.panels[speciesId]?.find(row => row.level === level);
  if (!row || !Number.isInteger(level)) throw new Error('INVALID_WILD_COMBATANT');
  return {
    ...pack.baseAttrs,
    hp: row.maxHp, maxHp: row.maxHp, mp: row.maxMp, maxMp: row.maxMp,
    physicalAtk: row.physicalAtk, physicalDef: row.physicalDef, magicAtk: row.magicAtk, magicDef: row.magicDef, speed: row.speed,
  };
}

export function validateWildContent(): string[] {
  const errors: string[] = [];
  const ids = [...WILD_SPECIES, ...WILD_SKILLS].map((x) => x.id);
  if (new Set(ids).size !== ids.length) errors.push('WILD_CONTENT_ID_CONFLICT');
  for (const species of WILD_SPECIES) {
    for (const id of species.skillIds)
      if (!WILD_SKILLS.some((s) => s.id === id))
        errors.push('UNKNOWN_WILD_SKILL');
    for (
      let level = WILD_REGION.minLevel;
      level <= WILD_REGION.maxLevel;
      level++
    ) {
      const attrs = wildPanel(species.id, level);
      if (
        ATTR_NAMES.some((key) => !Number.isFinite(attrs[key]) || attrs[key] < 0)
      )
        errors.push('INVALID_WILD_ATTRIBUTE');
    }
  }
  return errors;
}
