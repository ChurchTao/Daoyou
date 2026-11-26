export interface BodyCultivationRankingInfo {
  realm: string;
  totalLevel: number;
  label: string;
}

export interface BattleRankingItem {
  id: string;
  rank: number;
  name: string;
  title: string | null;
  age: number;
  realm: string;
  realm_stage: string;
  origin: string | null;
  sectAffiliation: string;
  bodyCultivation?: BodyCultivationRankingInfo;
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

export type RankingsDisplayItem = BattleRankingItem | WealthRankingEntry;
