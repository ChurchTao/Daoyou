export const TOWER_BLESSING_IDS = [
  'might',
  'spell',
  'edge',
  'crit',
  'iron',
  'vigor',
  'shell',
  'haste',
  'mend',
  'beast',
  'beastHaste',
  'beastHide',
] as const;

export type TowerBlessingId = (typeof TOWER_BLESSING_IDS)[number];
