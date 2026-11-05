import type { DungeonHistoryResult } from '@daoyou/game-domain/dungeon';
import type { ResourceOperation } from '@daoyou/game-domain/resources';

export interface DungeonHistorySummary {
  id: string;
  theme: string;
  title: string;
  mode: 'mystery' | 'exorcism';
  /** 除祟一场未胜时为 null，列表显示“未成”。 */
  rewardTier: string | null;
  score: number | null;
  createdAt: string;
}

export interface DungeonHistoryDetail {
  id: string;
  theme: string;
  result: DungeonHistoryResult;
  log: string;
  realGains: ResourceOperation[] | null;
  createdAt: string;
}

export interface DungeonHistoryPage {
  records: DungeonHistorySummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
