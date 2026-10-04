/** Public world/atlas capabilities. Keep implementation files private. */
export {
  ATLAS_ANCHORS,
  ATLAS_REGIONS,
  getAtlasLocations,
  getAtlasRegion,
  hasAtlasMap,
} from '../../world/mapAtlas.js';
export type { AtlasPoint, AtlasRegionId } from '../../world/mapAtlas.js';
export {
  ATLAS_CATEGORY_IDS,
  getAtlasCategory,
  getAtlasShortName,
  matchesAtlasCategories,
  parseAtlasCategories,
} from '../../world/mapAtlasCategories.js';
export type { AtlasCategory } from '../../world/mapAtlasCategories.js';
