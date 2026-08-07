// Core
export {
  CombatStateMachine,
  type CombatContext,
} from './core/CombatStateMachine';
export { EventBus } from './core/EventBus';
export * from './core/types';
export { BattleRoster, type BattleTeam } from './core/BattleRoster';
export { BattleRuntime } from './runtime/BattleRuntime';
export {
  LogicalBattleClock,
  SystemBattleClock,
  type BattleClock,
} from './runtime/BattleClock';

// Units
export { AbilityContainer } from './units/AbilityContainer';
export { AttributeSet } from './units/AttributeSet';
export { BuffContainer } from './units/BuffContainer';
export { Unit } from './units/Unit';

// Abilities
export * from './abilities';
export { Ability } from './abilities/Ability';
export { ActiveSkill } from './abilities/ActiveSkill';
export { PassiveAbility } from './abilities/PassiveAbility';

// Buffs
export { Buff } from './buffs/Buff';

// Systems
export { DamageSystem } from './systems/DamageSystem';
export { VictorySystem, type VictoryResult } from './systems/VictorySystem';
export { InitiativeSystem } from './systems/InitiativeSystem';
export {
  TeamVictorySystem,
  type TeamVictoryResult,
} from './systems/TeamVictorySystem';

// Adapters
export {
  CultivatorAdapter,
  type CultivatorData,
} from './adapters/CultivatorAdapter';

// Data-Driven System
export { DataDrivenActiveSkill } from './abilities/DataDrivenActiveSkill';
export { LayeredDataDrivenActiveSkill } from './abilities/LayeredDataDrivenActiveSkill';
export { DataDrivenBuff } from './buffs/DataDrivenBuff';
export { AbilityFactory } from './factories/AbilityFactory';
export { BuffFactory } from './factories/BuffFactory';
export { AbilityDataLoader } from './loaders/AbilityDataLoader';
export {
  combatStatusTemplateRegistry,
  getAllCombatStatusTemplates,
  getCombatStatusDisplay,
  getCombatStatusTemplate,
  normalizePersistentCombatStatuses,
} from './setup/CombatStatusTemplateRegistry';
export { createBattleUnitsWithInit } from './setup/BattleInitApplier';
export type {
  BattleInitConfigV5,
  BattleStateStrategyId,
  BattleUnitInitFragment,
  BattleUnitInitSpec,
  CombatStatusTemplate,
  PersistentCombatStatusV5,
  ResolvedBattleInitConfigV5,
  ResolvedBattleUnitInit,
  ResourcePointState,
  TrainingRoomModifierDraft,
} from './setup/types';
export {
  assertPreparedBattleContext,
  mergeBattleUnitInitFragments,
  prepareBattleContext,
  prepareStandardFullBattle,
  projectBattleEntryState,
  projectBattleUnitEntryState,
  type BattleEntryResourceView,
  type BattleEntryState,
  type BattleEntryUnitState,
  type BattleResourceSource,
  type BattleUnitStateStrategy,
  type PreparedBattleContext,
  type PrepareBattleContextOptions,
} from './setup/BattleStateStrategy';

// Main Entry
export { BattleEngineV5, type BattleResult } from './BattleEngineV5';
export * from './v4';
export * from './persistence';
export * from './round';
export * from './match';
