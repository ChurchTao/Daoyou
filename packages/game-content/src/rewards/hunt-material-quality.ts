import type { RealmType } from '@daoyou/constants/realms';

/** Each higher quality retains this fraction of the previous quality's weight. */
export const HUNT_MATERIAL_QUALITY_DECAY_BY_REALM: Record<RealmType, number> = {
  炼气: 0.55,
  筑基: 0.575,
  金丹: 0.6,
  元婴: 0.625,
  化神: 0.65,
  炼虚: 0.675,
  合体: 0.7,
  大乘: 0.725,
  渡劫: 0.75,
};
