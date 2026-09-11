import { WILD_SPECIES } from '../wild/content';
import progressionData from './data/progression.json';
import skillsData from './data/skills.json';
import speciesData from './data/species.json';
import { loadBeastPacks } from './pack';
import { compileBeastSkill } from './skill-compiler';

const packs = loadBeastPacks(
  speciesData,
  skillsData,
  progressionData,
  WILD_SPECIES.map((s) => s.id),
);
export const BEAST_SPECIES = packs.species.species;
export const BEAST_GENERATION = packs.species.generation;
export const BEAST_SKILLS = packs.skills.skills.map(compileBeastSkill);
export const BEAST_SKILL_FAMILIES = packs.skills.families;
export const BEAST_BOOK_SKILLS = packs.skills.skills.filter((s) => s.book);
export const BEAST_COMBO_SKILL_IDS = packs.skills.skills
  .filter((s) => s.effect.type === 'combo')
  .map((s) => s.id);
export const BEAST_PROGRESSION = packs.progression;
