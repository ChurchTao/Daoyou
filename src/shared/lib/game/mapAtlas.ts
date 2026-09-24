import {
  getAllMapNodes,
  getAllSatelliteNodes,
  getAllSectLandmarks,
  getWorldMapLocation,
  type WorldMapLocation,
} from './mapSystem';

export const ATLAS_REGIONS = [
  { id: 'tiannan', name: '天南', x: 0.855, y: 0.79 },
  { id: 'mulan', name: '慕兰草原', x: 0.88, y: 0.45 },
  { id: 'luanxinghai', name: '乱星海', x: 0.48, y: 0.73 },
  { id: 'dajin', name: '大晋皇朝', x: 0.48, y: 0.24 },
  { id: 'northland', name: '北境冰原', x: 0.45, y: 0.07 },
  { id: 'nanjiang', name: '南疆', x: 0.445, y: 0.395 },
  { id: 'tianlan', name: '天澜草原', x: 0.87, y: 0.29 },
  { id: 'tiansha', name: '天沙大陆', x: 0.075, y: 0.13 },
  { id: 'wulonghai', name: '五龙海', x: 0.18, y: 0.52 },
  { id: 'wubianhai', name: '无边海', x: 0.62, y: 0.5 },
  { id: 'farwest', name: '极西之地', x: 0.77, y: 0.925 },
  { id: 'hurricane-desert', name: '飓风沙漠', x: 0.825, y: 0.62 },
] as const;

export type AtlasRegionId = (typeof ATLAS_REGIONS)[number]['id'];
export type AtlasPoint = readonly [number, number];

// 展示名称独立于 map.json 的业务地域名称。
const REGION_BY_BUSINESS_NAME: Readonly<Record<string, AtlasRegionId>> = {
  天南: 'tiannan',
  慕兰: 'mulan',
  乱星海: 'luanxinghai',
  大晋: 'dajin',
};

// 只拆分新版展示区域，附属地点和宗门随主节点归区。
const REGION_BY_MAIN_NODE: Readonly<Record<string, AtlasRegionId>> = {
  DJ_NORTH_01: 'northland',
  DJ_SOUTH_01: 'nanjiang',
};

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
  if (!parent || !('region' in parent)) return undefined;
  const regionId =
    REGION_BY_MAIN_NODE[parent.id] ?? REGION_BY_BUSINESS_NAME[parent.region];
  return ATLAS_REGIONS.find((region) => region.id === regionId);
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

export const MULAN_ANCHORS: Readonly<Record<string, AtlasPoint>> = {
  ML_PLAINS_01: [0.5, 0.55],
  SAT_ML_01: [0.15, 0.75],
  SAT_ML_02: [0.195, 0.212],
  WILD_ML_STONESEA: [0.765, 0.318],
};

export const DAJIN_ANCHORS: Readonly<Record<string, AtlasPoint>> = {
  DJ_CENTRAL_01: [0.65, 0.485],
  DJ_KW_01: [0.13, 0.145],
  DJ_RIFT_01: [0.268, 0.37],
  DJ_VOID_01: [0.12, 0.775],
  DJ_SKY_01: [0.79, 0.08],
  DJ_TRIB_01: [0.938, 0.285],
  SAT_DJ_02: [0.225, 0.435],
  SAT_DJ_10: [0.275, 0.49],
  SAT_DJ_03: [0.105, 0.81],
  SAT_DJ_11: [0.225, 0.787],
  SAT_DJ_04: [0.875, 0.28],
  SAT_DJ_12: [0.93, 0.335],
  SAT_DJ_06: [0.187, 0.095],
  SAT_DJ_13: [0.167, 0.278],
  SAT_DJ_07: [0.446, 0.552],
  SAT_DJ_08: [0.866, 0.106],
  WILD_KW_THUNDER: [0.107, 0.079],
  SECT_TIANYAN: [0.197, 0.19],
  SECT_YOUDU: [0.1, 0.655],
  SECT_JIUJIE: [0.902, 0.373],
};

export const NANJIANG_ANCHORS: Readonly<Record<string, AtlasPoint>> = {
  DJ_SOUTH_01: [0.5, 0.42],
  SAT_DJ_01: [0.153, 0.116],
  WILD_DJ_BANYAN: [0.235, 0.716],
  WILD_DJ_DARKCAVE: [0.854, 0.742],
  SECT_WUXIANG: [0.82, 0.27],
};

export const NORTHLAND_ANCHORS: Readonly<Record<string, AtlasPoint>> = {
  DJ_NORTH_01: [0.65, 0.38],
  SAT_DJ_05: [0.747, 0.514],
  SAT_DJ_09: [0.579, 0.303],
};

export const ATLAS_ANCHORS = {
  tiannan: TIANNAN_ANCHORS,
  luanxinghai: LUANXINGHAI_ANCHORS,
  mulan: MULAN_ANCHORS,
  dajin: DAJIN_ANCHORS,
  nanjiang: NANJIANG_ANCHORS,
  northland: NORTHLAND_ANCHORS,
};

export function hasAtlasMap(
  id: AtlasRegionId,
): id is keyof typeof ATLAS_ANCHORS {
  return id in ATLAS_ANCHORS;
}
