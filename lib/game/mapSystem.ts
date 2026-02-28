import { RealmType } from '@/types/constants';
import { MarketLayer, RegionProfileKey } from '@/types/market';
import mapData from '../../data/map.json';

export interface NodeMarketConfig {
  enabled: boolean;
  allowed_layers: MarketLayer[];
  region_profile: RegionProfileKey;
}

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

export function getNodesByRegion(region: string): MapNode[] {
  return worldData.map_nodes.filter((n) => n.region === region);
}

export function getSatellitesForNode(parentId: string): SatelliteNode[] {
  return worldData.satellite_nodes.filter((n) => n.parent_id === parentId);
}

export function getMarketEnabledNodes(): MapNode[] {
  return worldData.map_nodes.filter((node) => node.market_config?.enabled);
}
