import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import {
  DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM,
  DUNGEON_REWARD_PACK,
} from '@daoyou/game-content/rewards/dungeon';

const completion = DUNGEON_REWARD_PACK.sources.completion;
const materialChance =
  (completion.chance * completion.weights.material) /
  Object.values(completion.weights).reduce((sum, weight) => sum + weight, 0);

/** Two guaranteed materials: each upper-quality tail is 1.1× a dungeon completion reward. */
export const HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM = Object.fromEntries(
  REALM_VALUES.map((realm) => {
    const dungeon = DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM[realm];
    const lowest = QUALITY_VALUES.find((quality) => dungeon[quality] > 0)!;
    const chances = { ...dungeon };
    let dungeonTail = 0;
    let higherChance = 0;
    for (const quality of [...QUALITY_VALUES].reverse()) {
      if (dungeon[quality] === 0) continue;
      dungeonTail += dungeon[quality];
      // P(at least one in two) = 1 - (1 - p)^2. The lowest quality absorbs
      // the remainder because hunts always grant two materials.
      const tail =
        quality === lowest
          ? 1
          : 1 - Math.sqrt(1 - Math.min(1, materialChance * dungeonTail * 1.1));
      chances[quality] = tail - higherChance;
      higherChance = tail;
    }
    return [realm, chances];
  }),
) as Record<RealmType, Record<Quality, number>>;
