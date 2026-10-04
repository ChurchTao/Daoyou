import type { DungeonDifficultyTier } from '../dungeon/difficulty.js';
import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import type { MarketLayer, RegionProfileKey } from '../market.js';

export interface NodeMarketConfig {
  enabled: boolean;
  allowed_layers: MarketLayer[];
  region_profile: RegionProfileKey;
  /** 各层灵种货架占比；未配置的坊市不固定注入灵种。 */
  seed_ratio?: Partial<Record<MarketLayer, number>>;
}

export interface DungeonMapConfig {
  difficulty: DungeonDifficultyTier;
}

export interface ResolvedDungeonMapConfig {
  realmRequirement: RealmType;
  difficultyTier: DungeonDifficultyTier;
  difficultyLabel: string;
  enemyDifficulty: number;
  allowedEnemyRealmStages: RealmStage[];
  allowBossLoadout: boolean;
  rewardBonus: number;
}

export interface MapNode {
  wild_encounter_id?: string;
  id: string;
  name: string;
  region: string;
  realm_requirement: RealmType;
  tags: string[];
  description: string;
  market_config?: NodeMarketConfig;
  dungeon_config?: DungeonMapConfig;
}

export interface SatelliteNode {
  wild_encounter_id?: string;
  id: string;
  name: string;
  parent_id: string;
  type: string;
  tags: string[];
  description: string;
  realm_requirement: RealmType;
  environmental_status?:
    | 'scorching'
    | 'freezing'
    | 'toxic_air'
    | 'formation_suppressed'
    | 'abundant_qi'
    | null; // 环境状态（可选）
  dungeon_config?: DungeonMapConfig;
}

export interface SectLandmark {
  id: string;
  kind: 'sect';
  sect_id: string;
  parent_id: string;
  name: string;
  description: string;
  tags: string[];
}

export interface MapData {
  world_name: string;
  map_nodes: MapNode[];
  sect_landmarks: SectLandmark[];
  satellite_nodes: SatelliteNode[];
}

export type MapNodeInfo = MapNode | SatelliteNode;

export type WorldMapLocation = MapNodeInfo | SectLandmark;
