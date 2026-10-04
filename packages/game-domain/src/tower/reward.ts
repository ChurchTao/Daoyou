import type { ItemGrant } from '../items/inventory.js';

export interface TowerReward {
  floor: number;
  items: ItemGrant[];
  spiritStones: number;
  reputation: number;
}

export interface TowerRewardPreview {
  floor: number;
  spiritStones: number;
  reputation: number;
  drops: {
    id: string;
    label: string;
    chance: number;
    quantity: number;
    realmLimited: boolean;
    random: boolean;
    definitionIds: string[];
  }[];
}
