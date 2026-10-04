import type { PresentedBattleInput } from '../combat/battle-input.js';
import type { PveRestoredState } from '../combat/runtime.js';
import type { PveCommandStrategyV1 } from '../combat/encounter.js';
import type { WildIndividual } from './individual.js';

export interface WildRuntimeSnapshot extends PveRestoredState {
  schemaVersion: 1;
  hostVersion: 'combat_v6_wild_runtime_v1';
  nodeId: string;
  playerId: string;
  input: PresentedBattleInput;
  npcStrategies: Record<string, PveCommandStrategyV1>;
  combatants: WildIndividual[];
}
