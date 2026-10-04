export { CHARACTER_MANUALS_V1 } from '@daoyou/game-content/manuals';
export { compileCharacterManualsV1, getManualSlotCount, isManualSlotV1, validateManualStateV1, withManualAttributes } from './compiler.js';
export { resolveCombatCapabilitiesV1 } from './capabilities.js';
export { changeManual } from './state.js';
export type {
  ManualSlotV1,
  ManualBuildV1,
  CultivatorManualStateV1,
  CombatV6CapabilityStackPolicy,
  CombatV6CapabilityContribution,
  CharacterManualDefV1,
  CharacterManualProjectionV1,
  CompileCharacterManualsV1Result,
  ResolveCombatCapabilitiesV1Result,
  ManualStateChangeResult,
} from '@daoyou/game-domain/manuals';
