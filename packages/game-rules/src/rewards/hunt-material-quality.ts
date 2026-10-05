import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import { DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM } from '@daoyou/game-content/rewards/dungeon';
import { HUNT_MATERIAL_QUALITY_DECAY_BY_REALM } from '@daoyou/game-content/rewards/hunt';

/** Keep dungeon quality ranges, with smoothly decreasing weights for hunts. */
export const HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM = Object.fromEntries(
  REALM_VALUES.map((realm) => {
    const dungeon = DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM[realm];
    const qualities = QUALITY_VALUES.filter((quality) => dungeon[quality] > 0);
    const decay = HUNT_MATERIAL_QUALITY_DECAY_BY_REALM[realm];
    const weights = qualities.map((_, index) => decay ** index);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const chances = { ...dungeon };
    qualities.forEach((quality, index) => {
      chances[quality] = weights[index] / totalWeight;
    });
    return [realm, chances];
  }),
) as Record<RealmType, Record<Quality, number>>;
