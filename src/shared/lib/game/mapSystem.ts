import { REALM_ORDER, type RealmType } from '@shared/types/constants';
import type { RealmStage } from '@shared/types/constants';
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
  enemyDifficulty: number;
  allowedEnemyRealmStages: RealmStage[];
  allowBossLoadout: boolean;
  rewardBonus: number;
}

const DUNGEON_DIFFICULTY_PRESETS: Record<
  DungeonDifficultyTier,
  Pick<
    ResolvedDungeonMapConfig,
    'difficultyLabel' | 'allowedEnemyRealmStages' | 'allowBossLoadout' | 'rewardBonus'
  >
> = {
  easy: {
    difficultyLabel: '低危',
    allowedEnemyRealmStages: ['初期'],
    allowBossLoadout: false,
    rewardBonus: 1,
  },
  normal: {
    difficultyLabel: '普通',
    allowedEnemyRealmStages: ['初期', '中期'],
    allowBossLoadout: false,
    rewardBonus: 1.1,
  },
  hard: {
    difficultyLabel: '险地',
    allowedEnemyRealmStages: ['中期', '后期'],
    allowBossLoadout: false,
    rewardBonus: 1.2,
  },
  elite: {
    difficultyLabel: '凶险',
    allowedEnemyRealmStages: ['后期', '圆满'],
    allowBossLoadout: true,
    rewardBonus: 1.3,
  },
  boss: {
    difficultyLabel: '绝境',
    allowedEnemyRealmStages: ['圆满'],
    allowBossLoadout: true,
    rewardBonus: 1.5,
  },
};

export const DUNGEON_ENEMY_DIFFICULTY_TABLE: Record<
  RealmType,
  Record<DungeonDifficultyTier, number>
> = {
  炼气: { easy: 10, normal: 20, hard: 35, elite: 55, boss: 75 },
  筑基: { easy: 12, normal: 24, hard: 40, elite: 60, boss: 80 },
  金丹: { easy: 15, normal: 28, hard: 45, elite: 65, boss: 85 },
  元婴: { easy: 18, normal: 32, hard: 50, elite: 70, boss: 88 },
  化神: { easy: 20, normal: 36, hard: 55, elite: 74, boss: 90 },
  炼虚: { easy: 22, normal: 38, hard: 58, elite: 76, boss: 92 },
  合体: { easy: 24, normal: 40, hard: 60, elite: 78, boss: 94 },
  大乘: { easy: 26, normal: 42, hard: 62, elite: 80, boss: 95 },
  渡劫: { easy: 28, normal: 45, hard: 65, elite: 82, boss: 96 },
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
    enemyDifficulty: resolveDungeonEnemyDifficulty(
      node.realm_requirement,
      difficultyTier,
    ),
    ...preset,
  };
}

export function resolveDungeonEnemyDifficulty(
  realm: RealmType,
  tier: DungeonDifficultyTier,
): number {
  return DUNGEON_ENEMY_DIFFICULTY_TABLE[realm]?.[tier] ?? 24;
}

export function canChallengeDungeonRealm(
  playerRealm: RealmType,
  dungeonRealm: RealmType,
): boolean {
  return REALM_ORDER[playerRealm] >= REALM_ORDER[dungeonRealm];
}

export function clampDungeonEnemyRealmStage(
  realmStage: RealmStage,
  config: ResolvedDungeonMapConfig,
): RealmStage {
  if (config.allowedEnemyRealmStages.includes(realmStage)) {
    return realmStage;
  }

  if (realmStage === '初期' || realmStage === '中期') {
    return config.allowedEnemyRealmStages[0] ?? '初期';
  }

  return (
    config.allowedEnemyRealmStages[config.allowedEnemyRealmStages.length - 1] ??
    '初期'
  );
}

export function getDungeonRewardBonus(
  tier: DungeonDifficultyTier | undefined,
): number {
  const difficultyTier =
    tier && tier in DUNGEON_DIFFICULTY_PRESETS ? tier : 'easy';
  return DUNGEON_DIFFICULTY_PRESETS[difficultyTier].rewardBonus;
}
