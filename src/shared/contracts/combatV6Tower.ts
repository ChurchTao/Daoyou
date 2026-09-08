import type { TowerBlessings } from '../engine/combat-v6/tower/host';
import type { ItemGrant } from '../inventory';
import type { TowerBlessingChoice, TowerSeasonMeta } from '../lib/tower/types';
import type { RealmType } from '../types/constants';
import type { CombatV6TrainingSessionViewV1 } from './combatV6';

export type TowerSessionView = Omit<
  CombatV6TrainingSessionViewV1,
  'encounterId' | 'tier'
>;
export interface TowerReward {
  floor: number;
  items: ItemGrant[];
  spiritStones: number;
  reputation: number;
}
export interface TowerView {
  season: TowerSeasonMeta;
  eligible: boolean;
  state: null | {
    runId: string;
    revision: number;
    realm: RealmType;
    floor: number;
    highestFloor: number;
    status: 'READY' | 'WAITING_BATTLE' | 'CHOOSING_BLESSING' | 'FINISHED';
    reason?: 'defeat' | 'fled' | 'draw' | 'retreated' | 'clear' | 'expired';
    blessings: TowerBlessings;
    choices: TowerBlessingChoice[];
    rewards: TowerReward[];
    battleId?: string;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
  };
}
