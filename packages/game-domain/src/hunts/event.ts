import type { REALM_VALUES } from '@daoyou/constants/realms';

export type HuntBossId = 'heretic' | 'demon' | 'beast' | 'bloodPython' | 'ironTurtle' | 'mistToad' | 'gildedCorpse' | 'shadowMarten';

export type HuntEvent = {
  id: string;
  bossId: HuntBossId;
  realm: (typeof REALM_VALUES)[number];
  level: number;
  nodeId: string;
  locationName: string;
  startsAt: number;
  expiresAt: number;
  /** Only present in battles created before the multi-resource reward rollout. */
  spiritStones?: number;
};
