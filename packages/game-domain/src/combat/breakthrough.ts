import type { PveRestoredState } from './runtime.js';
import type { PresentedBattleInput } from './battle-input.js';

export type BreakthroughChallengeId = 'heart_demon_nascent' | 'tribulation_deity' | 'law_insight_void' | 'tribulation_body' | 'inner_demon_grand' | 'heavenly_tribulation_final';


export interface BreakthroughSnapshot extends PveRestoredState {
  version: 'breakthrough-v6-battle-v1';
  playerId: string;
  input: PresentedBattleInput;
}
