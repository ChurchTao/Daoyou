import type { ItemGrant } from '../items/inventory.js';
import type { RealmType } from '@daoyou/constants/realms';
import type { DungeonDifficultyTier } from './difficulty.js';

export type DungeonRewardSource = 'exploration' | 'battle' | 'completion';

export interface DungeonRewardEntry {
  key: string;
  items: ItemGrant[];
  experience: number;
  spiritStones: number;
  beastExperience?: { beastId: string; amount: number };
}

export interface DungeonRewardPlan {
  key: string;
  items: ItemGrant[];
  materialCount: number;
  materialRealm: RealmType;
  materialSeed: string;
}

export interface DungeonRewardResourceContext {
  mapRealm: RealmType;
  playerRealm: RealmType;
  dangerScore: number;
  difficultyTier: DungeonDifficultyTier;
}
