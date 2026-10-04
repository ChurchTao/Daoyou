/** Public manuals capabilities. Keep implementation files private. */
export type {
  CharacterManualDefV1,
  CharacterManualProjectionV1,
  CombatV6CapabilityContribution,
  CombatV6CapabilityStackPolicy,
  CompileCharacterManualsV1Result,
  CultivatorManualStateV1,
  ManualBuildV1,
  ManualSlotV1,
  ManualStateChangeResult,
  ResolveCombatCapabilitiesV1Result,
} from '../manuals/index.js';
export { manualJadeCost, previewManualAction } from '../manuals/action.js';
export {
  enlightenmentMaterialProblem,
  enlightenmentQualityCap,
  prepareEnlightenment,
  rollEnlightenment,
} from '../manuals/enlightenment.js';
