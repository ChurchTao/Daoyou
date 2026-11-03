import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import type { DungeonDifficultyTier } from '../dungeon/difficulty.js';
import type { MarketLayer, RegionProfileKey } from '../market.js';

export interface NodeMarketConfig {
  enabled: boolean;
  allowed_layers: MarketLayer[];
  region_profile: RegionProfileKey;
  /** 各层灵种货架占比；未配置的坊市不固定注入灵种。 */
  seed_ratio?: Partial<Record<MarketLayer, number>>;
}

/**
 * 节点的解谜剧本设定：生成案卷时的素材。房间、人物、往事与物件都应能从这里取材，
 * 让同一模板在不同节点生成的剧本带有地域特色。
 */
/**
 * 解谜副本场景插画的地貌类别：洞府、山门残殿、古墓、古塔碑林、山林药园、
 * 水泽海岛、草原祭坛、魔域裂隙、地底秘窟、冰窟。
 */
export const DUNGEON_SCENE_KIND_VALUES = [
  'cave',
  'sect_ruin',
  'tomb',
  'tower_stele',
  'forest',
  'sea',
  'steppe',
  'void',
  'underground',
  'ice',
] as const;

export type DungeonSceneKind = (typeof DUNGEON_SCENE_KIND_VALUES)[number];

export interface DungeonScenarioConfig {
  /** 场景插画的地貌类别，逐个节点显式指定。 */
  scene?: DungeonSceneKind;
  /** 可抽取的解谜剧本模板 id；配置后该节点走解谜模式。 */
  templates: string[];
  /** 总述：此地是什么、给人什么感觉。 */
  setting: string;
  /** 此地典型的场所，6–10 个，作为房间的取材。 */
  places: string[];
  /** 可能在此出现的人物身份，4–8 个。 */
  inhabitants: string[];
  /** 此地的往事钩子，1–3 条，作为真相与动机的来源。 */
  history: string[];
  /** 此地特有的器物与痕迹，4–8 个。 */
  objects: string[];
  /** 相关势力，0–4 个。 */
  factions: string[];
  /** 禁写内容：与世界观冲突、不该出现在此地的东西。 */
  forbidden: string[];
}

export interface DungeonMapConfig {
  difficulty: DungeonDifficultyTier;
  scenario?: DungeonScenarioConfig;
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
