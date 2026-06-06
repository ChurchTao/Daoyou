import type { RealmType } from '@shared/types/constants';
import type { MarketLayer, RegionProfileKey } from '@shared/types/market';
import mapData from '../../data/map.json';

export type DungeonDifficultyTier =
  | 'easy'
  | 'normal'
  | 'hard'
  | 'elite'
  | 'boss';

export interface NodeMarketConfig {
  enabled: boolean;
  allowed_layers: MarketLayer[];
  region_profile: RegionProfileKey;
}

export interface DungeonMapConfig {
  difficulty: DungeonDifficultyTier;
}

export interface ResolvedDungeonMapConfig {
  realmRequirement: RealmType;
  difficultyTier: DungeonDifficultyTier;
  difficultyLabel: string;
  enemyDifficultyMultiplier: number;
  maxEnemyDifficulty: number;
  allowBossLoadout: boolean;
}

const DUNGEON_DIFFICULTY_PRESETS: Record<
  DungeonDifficultyTier,
  Omit<ResolvedDungeonMapConfig, 'realmRequirement' | 'difficultyTier'>
> = {
  easy: {
    difficultyLabel: '低危',
    enemyDifficultyMultiplier: 0.35,
    maxEnemyDifficulty: 35,
    allowBossLoadout: false,
  },
  normal: {
    difficultyLabel: '普通',
    enemyDifficultyMultiplier: 0.5,
    maxEnemyDifficulty: 50,
    allowBossLoadout: false,
  },
  hard: {
    difficultyLabel: '险地',
    enemyDifficultyMultiplier: 0.65,
    maxEnemyDifficulty: 70,
    allowBossLoadout: false,
  },
  elite: {
    difficultyLabel: '凶险',
    enemyDifficultyMultiplier: 0.8,
    maxEnemyDifficulty: 85,
    allowBossLoadout: true,
  },
  boss: {
    difficultyLabel: '绝境',
    enemyDifficultyMultiplier: 0.95,
    maxEnemyDifficulty: 100,
    allowBossLoadout: true,
  },
};

export interface MapNode {
  id: string;
  name: string;
  region: string;
  realm_requirement: RealmType;
  tags: string[];
  description: string;
  connections: string[];
  x: number;
  y: number;
  market_config?: NodeMarketConfig;
  dungeon_config?: DungeonMapConfig;
}

export interface SatelliteNode {
  id: string;
  name: string;
  parent_id: string;
  type: string;
  tags: string[];
  description: string;
  connections: string[];
  x: number;
  y: number;
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

export interface MapData {
  world_name: string;
  map_nodes: MapNode[];
  satellite_nodes: SatelliteNode[];
}

// Load typed data
const worldData: MapData = mapData as MapData;

export type MapNodeInfo = MapNode | SatelliteNode;

export function getAllMapNodes(): MapNode[] {
  return worldData.map_nodes;
}

export function getAllSatelliteNodes(): SatelliteNode[] {
  return worldData.satellite_nodes;
}

export function getMapNode(id: string): MapNode | SatelliteNode | undefined {
  const mainNode = worldData.map_nodes.find((n) => n.id === id);
  if (mainNode) return mainNode;
  return worldData.satellite_nodes.find((n) => n.id === id);
}

export function isSatelliteNode(id: string): boolean {
  return worldData.satellite_nodes.some((n) => n.id === id);
}

export function getNodesByRegion(region: string): MapNode[] {
  return worldData.map_nodes.filter((n) => n.region === region);
}

export function getSatellitesForNode(parentId: string): SatelliteNode[] {
  return worldData.satellite_nodes.filter((n) => n.parent_id === parentId);
}

export function getMarketEnabledNodes(): MapNode[] {
  return worldData.map_nodes.filter((node) => node.market_config?.enabled);
}

export function resolveDungeonMapConfig(
  node: MapNodeInfo,
): ResolvedDungeonMapConfig {
  const configuredTier = node.dungeon_config?.difficulty;
  const difficultyTier =
    configuredTier && configuredTier in DUNGEON_DIFFICULTY_PRESETS
      ? configuredTier
      : 'normal';
  const preset = DUNGEON_DIFFICULTY_PRESETS[difficultyTier];

  return {
    realmRequirement: node.realm_requirement,
    difficultyTier,
    ...preset,
  };
}

export function scaleDungeonBattleDifficulty(
  rawDifficulty: number,
  config: ResolvedDungeonMapConfig,
): number {
  return Math.max(
    0,
    Math.min(
      config.maxEnemyDifficulty,
      Math.round(rawDifficulty * config.enemyDifficultyMultiplier),
    ),
  );
}
