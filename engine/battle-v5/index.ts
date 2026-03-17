// Core
export { EventBus } from './core/EventBus';
export { CombatStateMachine, type CombatContext } from './core/CombatStateMachine';
export * from './core/types';

// Units
export { Unit } from './units/Unit';
export { AttributeSet } from './units/AttributeSet';
export { AbilityContainer } from './units/AbilityContainer';
export { BuffContainer } from './units/BuffContainer';

// Abilities
export { Ability } from './abilities/Ability';
export { ActiveSkill } from './abilities/ActiveSkill';
export { PassiveAbility } from './abilities/PassiveAbility';
export * from './abilities';

// Buffs
export { Buff } from './buffs/Buff';

// Systems
export { DamageSystem, type DamageCalculationParams, type DamageResult } from './systems/DamageSystem';
export { CombatLogSystem } from './systems/CombatLogSystem';
export { VictorySystem, type VictoryResult } from './systems/VictorySystem';

// Adapters
export { CultivatorAdapter, type CultivatorData } from './adapters/CultivatorAdapter';

// Main Entry
export { BattleEngineV5, type BattleResult } from './BattleEngineV5';
