/** Public world/map capabilities. Keep implementation files private. */
export { getMapAreaContent, getMapPassage } from '../../world/areas.js';
export { getSectStoryEntry } from '../../world/sect-story-entries.js';
export { default as WORLD_MAP_DATA } from '../../world/data/map.json' with { type: 'json' };
export {
  getAllMapNodes,
  getAllSatelliteNodes,
  getAllSectLandmarks,
  getMapNode,
  getSectLandmark,
  getSectLandmarkBySectId,
  getWorldMapLocation,
  isSatelliteNode,
} from '../../world/map.js';
