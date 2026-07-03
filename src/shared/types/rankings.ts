import { RankingItem } from '@server/lib/redis/rankings';

export type BattleRankingItem = RankingItem;

export interface BodyCultivationRankingInfo {
  realm: string;
  totalLevel: number;
  label: string;
}

export type RankingItemType = 'artifact' | 'skill' | 'elixir' | 'technique';

export interface ItemRankingEntry {
  id: string; // itemId
  rank: number;
  name: string;
  itemType: RankingItemType;
  type?: string;
  quality?: string;
  ownerName: string;
  score: number;
  description?: string;
  element?: string;
  slot?: string;
  cost?: number;
  cooldown?: number;
  quantity?: number;
  spec?: unknown;
  productModel?: unknown;

  // Optional properties for UI compatibility
  title?: string;
}

export interface WealthRankingEntry {
  id: string;
  rank: number;
  rankingType: 'wealth';
  name: string;
  title?: string | null;
  realm: string;
  realm_stage: string;
  age: number;
  origin?: string | null;
  spiritStones: number;
}

export type RankingsDisplayItem =
  | BattleRankingItem
  | ItemRankingEntry
  | WealthRankingEntry;
