/** Public beasts/presentation capabilities. Keep implementation files private. */
export { listBeastCodex } from '../../beasts/codex.js';
export type {
  BeastCodexEntry,
  BeastCodexHabitat,
  BeastCodexSkill,
} from '../../beasts/codex.js';
export {
  beastSkillPresentation,
  findBeastSkillPresentation,
} from '../../beasts/skill-presentation.js';
export type { BeastSkillPresentation } from '../../beasts/skill-presentation.js';
export { beastMutationBonus } from '../../beasts/trait-generator.js';
