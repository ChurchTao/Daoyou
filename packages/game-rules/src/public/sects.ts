/** Public sects capabilities. Keep implementation files private. */
export { compileCurrentSectCombatV6 } from '../sects/index.js';
export type {
  CombatV6PanelContribution,
  CombatV6SectId,
  CompileSectCombatV6Result,
  MeridianNodeDefV6,
  SectCombatProgressV6,
  SectCombatProjectionV6,
  SectDefinitionV6,
  SectMeridianLoadoutV6,
  SectMethodDefV6,
  SectPathDefV6,
  SectSkillDefV6,
  SkillPatchV6,
  TianyanElementV1,
  TianyanReactionDefV1,
  TianyanReactionKindV1,
} from '../sects/index.js';
export { SECT_PROGRESSION, methodLevelCap } from '../sects/progression-pack.js';
export type { SectProgressionPack } from '../sects/progression-pack.js';
export {
  canSelectMeridianNode,
  connectedMeridianSelection,
  meridianNodesConnect,
  toggleMeridianNode,
} from '../sects/meridian-selection.js';
export {
  MERIDIAN_LEVELS,
  SectV6RuleError,
  meridianUnlockCost,
  methodTrainingCost,
  sectV6Change,
  transferSectProgress,
} from '../sects/progression.js';
export {
  createEmptySectCombatProgressV6,
  createFreshCombatV6MethodLevels,
  createSectCombatView,
} from '../sects/build-state.js';
