import type { PveRestoredState } from '../combat/runtime.js';
import type { PresentedBattleInput } from '../combat/battle-input.js';
import type { TowerBlessingId } from './blessings.js';
import type { TowerNpcPlan } from './npc-plan.js';

export type TowerBlessings = Partial<Record<TowerBlessingId, number>>;

export interface TowerBattleSnapshot extends PveRestoredState {
  version: 'tower-v6-v8';
  playerId: string;
  input: PresentedBattleInput;
  npcPlans: Record<string, TowerNpcPlan>;
}
