

export const TOWER_BLESSING_IDS = [
  'physical_power',
  'spell_power',
  'guard',
  'swiftness',
  'beast_power',
] as const;

export type TowerBlessingId = (typeof TOWER_BLESSING_IDS)[number];
