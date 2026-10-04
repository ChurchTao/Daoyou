/** Public world/map capabilities. Keep implementation files private. */
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
export { default as WORLD_MAP_DATA } from '../../world/data/map.json' with { type: 'json' };
