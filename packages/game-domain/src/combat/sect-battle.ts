import type { CreateBattleInput, SkillDef, StatusDef } from '@daoyou/combat-core/types';
import type { PveRestoredState } from './runtime.js';
import type { PresentedBattleInput } from './battle-input.js';

export type SectBattleResourcePolicy = 'full' | 'persistent';


/** Enrollment freezes native enemy units, including only the eligible lead pet. */
export interface SectBattleOpponent {
  unitAppearances?: PresentedBattleInput['unitAppearances'];
  version: 'sect-v6-opponent-v1';
  units: CreateBattleInput['units'];
  skills: SkillDef[];
  statusDefs: StatusDef[];
}


export interface SectBattleSnapshot extends PveRestoredState {
  version: 'sect-v6-battle-v1';
  playerId: string;
  resourcePolicy: SectBattleResourcePolicy;
  input: PresentedBattleInput;
}
