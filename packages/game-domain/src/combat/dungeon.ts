import type { PveRestoredState } from './runtime.js';
import type { PresentedBattleInput } from './battle-input.js';

export type DungeonTemplate = 'normal' | 'elite' | 'boss';

export interface DungeonBattleSnapshot extends PveRestoredState {
  version: 'dungeon-v6-v1';
  playerId: string;
  input: PresentedBattleInput;
}
