// Core
export {
  CombatStateMachine,
  type CombatContext,
} from './core/CombatStateMachine';
export { EventBus } from './core/EventBus';
export * from './core/types';

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
export { CombatLogSystem } from './systems/CombatLogSystem';
export { DamageSystem } from './systems/DamageSystem';
export { VictorySystem, type VictoryResult } from './systems/VictorySystem';

// Adapters
export {
  CultivatorAdapter,
  type CultivatorData,
} from './adapters/CultivatorAdapter';

// Data-Driven System
export { DataDrivenActiveSkill } from './abilities/DataDrivenActiveSkill';
export { DataDrivenBuff } from './buffs/DataDrivenBuff';
export { AbilityFactory } from './factories/AbilityFactory';
export { BuffFactory } from './factories/BuffFactory';
export { AbilityDataLoader } from './loaders/AbilityDataLoader';

// Main Entry
export { BattleEngineV5, type BattleResult } from './BattleEngineV5';
