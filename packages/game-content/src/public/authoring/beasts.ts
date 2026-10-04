/** Public authoring/beasts capabilities. Keep implementation files private. */
export { default as BEASTS_FUSION_SCHEMA } from '../../beasts/data/fusion.schema.json' with { type: 'json' };
export { default as BEASTS_PROGRESSION_SCHEMA } from '../../beasts/data/progression.schema.json' with { type: 'json' };
export { default as BEASTS_SKILLS_SCHEMA } from '../../beasts/data/skills.schema.json' with { type: 'json' };
export { default as BEASTS_SPECIES_SCHEMA } from '../../beasts/data/species.schema.json' with { type: 'json' };
export { default as BEASTS_REFINEMENT_SCHEMA } from '../../beasts/data/refinement.schema.json' with { type: 'json' };
export { compileBeastSkill } from '../../beasts/skill-compiler.js';
