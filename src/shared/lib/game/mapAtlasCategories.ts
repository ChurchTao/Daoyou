import type { WorldMapLocation } from './mapSystem';

export const ATLAS_CATEGORY_IDS = [
  'wild',
  'dungeon',
  'market',
  'sect',
  'landmark',
] as const;
export type AtlasCategory = (typeof ATLAS_CATEGORY_IDS)[number];

/** Each location has one purpose, derived from its actual gameplay entry. */
export function getAtlasCategory(location: WorldMapLocation): AtlasCategory {
  if ('sect_id' in location) return 'sect';
  if (location.wild_encounter_id) return 'wild';
  if (location.dungeon_config && !('region' in location)) return 'dungeon';
  if ('market_config' in location && location.market_config?.enabled)
    return 'market';
  return 'landmark';
}

/** Empty means all; multiple categories form a union, never duplicate locations. */
export function matchesAtlasCategories(
  location: WorldMapLocation,
  categories: readonly AtlasCategory[],
): boolean {
  return !categories.length || categories.includes(getAtlasCategory(location));
}

export function parseAtlasCategories(value: string | null): AtlasCategory[] {
  const requested = new Set(value?.split(','));
  return ATLAS_CATEGORY_IDS.filter((type) => requested.has(type));
}

// Only display names are shortened; gameplay and search keep the full names.
const SHORT_NAMES: Record<string, string> = {
  SAT_TN_01: '无名古修士洞府',
  SAT_TN_02: '崩塌的上古宗门',
  SAT_LX_01: '无名荒岛',
  SAT_LX_02: '沉船遗迹',
  SAT_ZMG_01: '空间断层带',
  SAT_DJ_01: '无名古墓',
  SAT_ML_01: '法士秘密祭坛',
  SAT_TN_03: '废弃药园',
  SAT_TN_08: '青溪坡',
  SAT_LX_07: '礁洞妖影',
  SAT_DJ_02: '逆鳞祭坛',
  SAT_DJ_10: '碎鳞石林',
  SAT_DJ_03: '沉日神殿',
  SAT_DJ_11: '黑潮贝场',
  SAT_DJ_04: '劫火回廊',
  SAT_DJ_12: '残雷碑林',
  SAT_TN_04: '黄枫谷后山禁地',
  SAT_TN_05: '古传送阵核心井',
  SAT_TN_06: '古魔祭坛群',
  SAT_YW_01: '天星宗旧阵库',
  SAT_LX_03: '圣山地脉秘窟',
  SAT_LX_04: '六连殿地底回廊',
  SAT_LX_05: '内殿星辰阶',
  SAT_ML_02: '圣禽祭天台',
  SAT_DJ_05: '万年玄冰库',
  SAT_DJ_06: '镇魔古塔',
  SAT_DJ_13: '灵液暗河',
  SAT_DJ_07: '天机阁旧址',
  SAT_TN_07: '藏经阁地窖',
  SAT_LX_06: '偏殿玉简廊',
  SAT_DJ_09: '玄冰藏经窟',
  SAT_DJ_08: '碎空战场',
  WILD_TN_MINE: '废矿深处',
  WILD_YW_CROW: '地火旁的鸦巢',
  WILD_TN_MOONLAKE: '月照天池',
  WILD_ML_STONESEA: '长风石海',
  WILD_ZMG_BLACKPOOL: '黑水潭',
  WILD_ZMG_VINES: '幽藤密林',
  WILD_DJ_BANYAN: '独木成林',
  WILD_DJ_DARKCAVE: '不见天',
  WILD_KW_THUNDER: '雷云崖',
};
export function getAtlasShortName(location: WorldMapLocation): string {
  return SHORT_NAMES[location.id] ?? location.name;
}
