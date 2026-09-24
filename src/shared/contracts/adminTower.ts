import type { publishedTowerEncounter } from '../engine/combat-v6/tower/published';
import type { TowerSeasonMeta } from '../lib/tower/types';
import type { TowerEnemyPreview } from '../lib/tower/weekly';
import type { RealmType } from '../types/constants';

export interface AdminTowerWeekSummary {
  seasonKey: string;
  schemaVersion: number;
  contentVersion: string;
  generatorVersion: string;
  publishedAt: string;
}

export interface AdminTowerView {
  currentSeason: TowerSeasonMeta;
  nextSeason: TowerSeasonMeta;
  weeks: AdminTowerWeekSummary[];
  seasonKey: string;
  realm: RealmType;
  floor: number;
  fingerprint: string | null;
  published: AdminTowerWeekSummary | null;
  configuration: {
    season: TowerSeasonMeta;
    previews: TowerEnemyPreview[];
    encounter: ReturnType<typeof publishedTowerEncounter>;
  } | null;
}
