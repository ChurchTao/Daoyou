import {
  getAllMapNodes,
  getAllSatelliteNodes,
  getAllSectLandmarks,
  getWorldMapLocation,
  type WorldMapLocation,
} from './mapSystem';

export const ATLAS_REGIONS = [
  { id: 'tiannan', name: '天南', x: 0.855, y: 0.79 },
  { id: 'mulan', name: '慕兰', x: 0.88, y: 0.45 },
  { id: 'luanxinghai', name: '乱星海', x: 0.48, y: 0.73 },
  { id: 'dajin', name: '大晋', x: 0.48, y: 0.24 },
] as const;

export type AtlasRegionId = (typeof ATLAS_REGIONS)[number]['id'];
export type AtlasPoint = readonly [number, number];

export function getAtlasLocations(): WorldMapLocation[] {
  return [
    ...getAllMapNodes(),
    ...getAllSatelliteNodes(),
    ...getAllSectLandmarks(),
  ];
}

export function getAtlasRegion(location: WorldMapLocation) {
  const parent =
    'region' in location ? location : getWorldMapLocation(location.parent_id);
  return ATLAS_REGIONS.find(
    (region) => parent && 'region' in parent && parent.region === region.name,
  );
}

// 展示坐标只用于独立区域底画，旧地图坐标和玩法事实仍由 map.json 持有。
export const TIANNAN_ANCHORS: Readonly<Record<string, AtlasPoint>> = {
  TN_YUE_01: [0.36, 0.61],
  TN_YUE_02: [0.175, 0.79],
  TN_YW_01: [0.69, 0.43],
  TN_XI_01: [0.32, 0.19],
  TN_BAICAO_01: [0.43, 0.405],
  TN_ZMG_01: [0.845, 0.17],
  TN_BORDER_01: [0.155, 0.385],
  SAT_TN_01: [0.345, 0.525],
  SAT_TN_02: [0.325, 0.145],
  SAT_ZMG_01: [0.795, 0.265],
  SAT_TN_03: [0.235, 0.745],
  SAT_TN_08: [0.425, 0.665],
  SAT_TN_04: [0.31, 0.655],
  SAT_TN_05: [0.12, 0.425],
  SAT_TN_06: [0.895, 0.14],
  SAT_YW_01: [0.615, 0.425],
  SAT_TN_07: [0.375, 0.735],
  WILD_TN_MINE: [0.175, 0.465],
  WILD_YW_CROW: [0.755, 0.365],
  WILD_TN_MOONLAKE: [0.27, 0.12],
  WILD_ZMG_BLACKPOOL: [0.87, 0.235],
  WILD_ZMG_VINES: [0.92, 0.31],
  SECT_LINGXIAO: [0.715, 0.285],
};

export const LUANXINGHAI_ANCHORS: Readonly<Record<string, AtlasPoint>> = {
  LX_INNER_01: [0.68, 0.397],
  LX_INNER_02: [0.852, 0.703],
  LX_OUTER_01: [0.13, 0.68],
  LX_VOID_01: [0.165, 0.108],
  SAT_LX_01: [0.38, 0.775],
  SAT_LX_02: [0.6, 0.51],
  SAT_LX_07: [0.806, 0.8],
  SAT_LX_03: [0.625, 0.328],
  SAT_LX_04: [0.938, 0.69],
  SAT_LX_05: [0.17, 0.05],
  SAT_LX_06: [0.235, 0.11],
};

export const ATLAS_ANCHORS = {
  tiannan: TIANNAN_ANCHORS,
  luanxinghai: LUANXINGHAI_ANCHORS,
};

export function hasAtlasMap(
  id: AtlasRegionId,
): id is keyof typeof ATLAS_ANCHORS {
  return id in ATLAS_ANCHORS;
}
