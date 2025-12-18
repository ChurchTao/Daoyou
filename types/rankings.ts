import { RankingItem } from '@/lib/redis/rankings';

export type BattleRankingItem = RankingItem;

export interface ItemRankingEntry {
  id: string; // itemId
  rank: number;
  name: string;
  type?: string;
  quality?: string;
  grade?: string; // For skills
  ownerName: string;
  score: number;
  description?: string;

  // Optional properties for UI compatibility
  title?: string;
  is_new_comer?: boolean;
}

export type RankingsDisplayItem = BattleRankingItem | ItemRankingEntry;
