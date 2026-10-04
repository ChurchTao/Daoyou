import type { CompiledCombatV6TrainingEncounterV1, CombatV6TrainingRuntimeSnapshotV1 } from './encounter.js';


export type CompiledPveEncounter = Pick<
  CompiledCombatV6TrainingEncounterV1,
  'playerId' | 'battleInput' | 'npcStrategies' | 'sourceProjectionVersions' | 'playerAutoStrategy'
>;

export type PveRestoredState = Pick<
  CombatV6TrainingRuntimeSnapshotV1,
  'state' | 'events' | 'rounds' | 'timeline'
>;
