import type { MapData, MapNode, SatelliteNode, SectLandmark, WorldMapLocation } from '@daoyou/game-domain/world/map';
import mapData from './data/map.json' with { type: 'json' };

// Load typed data
const worldData: MapData = mapData as MapData;

export function getAllMapNodes(): MapNode[] {
  return worldData.map_nodes;
}

export function getAllSatelliteNodes(): SatelliteNode[] {
  return worldData.satellite_nodes;
}

export function getAllSectLandmarks(): SectLandmark[] {
  return worldData.sect_landmarks;
}

export function getSectLandmark(id: string): SectLandmark | undefined {
  return worldData.sect_landmarks.find((landmark) => landmark.id === id);
}

export function getSectLandmarkBySectId(
  sectId: string,
): SectLandmark | undefined {
  return worldData.sect_landmarks.find(
    (landmark) => landmark.sect_id === sectId,
  );
}

export function getMapNode(id: string): MapNode | SatelliteNode | undefined {
  const mainNode = worldData.map_nodes.find((n) => n.id === id);
  if (mainNode) return mainNode;
  return worldData.satellite_nodes.find((n) => n.id === id);
}

export function isSatelliteNode(id: string): boolean {
  return worldData.satellite_nodes.some((n) => n.id === id);
}

export function getWorldMapLocation(id: string): WorldMapLocation | undefined {
  return getMapNode(id) ?? getSectLandmark(id);
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
