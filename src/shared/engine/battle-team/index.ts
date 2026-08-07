export { TeamBattleEngine } from './TeamBattleEngine';
export type { TeamBattleEngineOptions } from './TeamBattleEngine';
export { TeamUnit } from './TeamUnit';
export type { TeamUnitOptions } from './TeamUnit';
export { Team } from './Team';
export { Formation } from './Formation';
export { TargetSelection } from './TargetSelection';
export { DamageResolver } from './DamageResolver';
export { TeamVictorySystem } from './TeamVictorySystem';
export { TeamBattleRecorder } from './TeamBattleRecorder';
export { TeamBattleEventBus } from './TeamBattleEventBus';
export { TeamAbility } from './TeamAbility';
export type { TeamAbilityContext, TeamBattleEngineApi } from './TeamAbility';
export { BasicStrike } from './abilities/BasicStrike';
export { AuraAbility } from './abilities/AuraAbility';
export type { AuraAbilityOptions } from './abilities/AuraAbility';
export { ChanceTriggerAbility } from './abilities/ChanceTriggerAbility';
export type { ChanceTriggerAbilityOptions } from './abilities/ChanceTriggerAbility';
export { ConditionalResponseAbility } from './abilities/ConditionalResponseAbility';
export type { ConditionalResponseAbilityOptions } from './abilities/ConditionalResponseAbility';
export { runPresetTeamBattle } from './mockPresets';
export type { RunPresetOptions } from './mockPresets';
export { buildPresetUnits, PRESET_UNITS } from './presets/presetUnits';
export type { PresetUnitConfig } from './presets/presetUnits';

// 技能库（library）
export { RecoveryAura } from './library/RecoveryAura';
export { ComboAura } from './library/ComboAura';
export { Pursuit } from './library/Pursuit';
export type { PursuitOptions } from './library/Pursuit';
export { ChargeAbility } from './library/ChargeAbility';
export type { ChargeAbilityOptions } from './library/ChargeAbility';
export { TauntAbility } from './library/TauntAbility';
export type { TauntAbilityOptions } from './library/TauntAbility';
export { performBasicAttack, selectBasicAttackTarget } from './library/basicAttackHelpers';
export { buildLibraryUnits, LIBRARY_PRESET_UNITS, buildLibrary5v5Units, LIBRARY_5V5_PRESET_UNITS, buildLibrary5v5Roster } from './library/presetLibraryUnits';
export type { LibraryPresetUnitConfig, RosterAbilityInfo, RosterUnitInfo } from './library/presetLibraryUnits';
export type {
  TeamSide,
  Position,
  TeamAbilityKind,
  TargetTeamFilter,
  TargetScope,
  TargetFilter,
  TeamTargetPolicy,
  DamagePayload,
  DamageResult,
  TeamBattleLogEvent,
  TeamUnitSnapshot,
  TeamBattleFrame,
  TeamBattleRecord,
  TeamBattleParticipants,
  TeamBattleOutcome,
} from './types';
