import { RankingItem } from '@/lib/redis/rankings';

export type BattleRankingItem = RankingItem;

export type RankingItemType = 'artifact' | 'skill' | 'elixir' | 'technique';

export interface ItemRankingEntry {
  id: string; // itemId
  rank: number;
  name: string;
  itemType: RankingItemType;
  type?: string;
  quality?: string;
  grade?: string; // For skills
  ownerName: string;
  score: number;
  description?: string;
  element?: string;
  slot?: string;
  requiredRealm?: string;
  cost?: number;
  cooldown?: number;
  quantity?: number;

  // Optional properties for UI compatibility
  title?: string;
  is_new_comer?: boolean;
}

export type RankingsDisplayItem = BattleRankingItem | ItemRankingEntry;
