import { WILD_PACK } from './pack';

export const WILD_CONTENT_VERSION = 'daoyou_wild_seeking_content_v2';
export const WILD_REGIONS = WILD_PACK.regions;
export function getWildRegion(nodeId: string) {
  return WILD_REGIONS.find((region) => region.nodeId === nodeId);
}
