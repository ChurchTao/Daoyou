import type { publishedTowerEncounter } from '../engine/combat-v6/tower/published.js';
import type { TowerSeasonMeta } from '../lib/tower/types.js';
import type { TowerEnemyPreview } from '../lib/tower/weekly.js';
import type { RealmType } from '../types/constants.js';

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
