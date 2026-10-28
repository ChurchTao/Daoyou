import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import {
  DAO_EQUIPMENT_SLOTS,
  EQUIPMENT_LEVELS,
} from '@daoyou/game-domain/equipment';

/** 历练最高发到合体。大乘、渡劫图纸不进历练。 */
export const YIELD_BLUEPRINT_REALM_CAP: RealmType = '合体';

const YIELD_STEPS = [
  { offset: -1, weight: 4 },
  { offset: 0, weight: 4 },
  { offset: 1, weight: 2 },
] as const;

/** 越接近当前境界权重越小：-3/-2/-1/0 = 8/4/2/1。 */
const LOWER_STEPS = [
  { offset: -3, weight: 8 },
  { offset: -2, weight: 4 },
  { offset: -1, weight: 2 },
  { offset: 0, weight: 1 },
] as const;

const NEAR_STEPS = [
  { offset: -1, weight: 4 },
  { offset: 0, weight: 1 },
] as const;

export type BlueprintDropProfile = 'yield' | 'lower' | 'near';

export function blueprintRealmWeights(
  realm: RealmType,
  profile: BlueprintDropProfile,
): { realm: RealmType; level: number; weight: number }[] {
  const steps =
    profile === 'yield' ? YIELD_STEPS : profile === 'near' ? NEAR_STEPS : LOWER_STEPS;
  const maxIndex =
    profile === 'yield'
      ? REALM_VALUES.indexOf(YIELD_BLUEPRINT_REALM_CAP)
      : REALM_VALUES.length - 1;
  const fold = profile === 'yield';
  const index = REALM_VALUES.indexOf(realm);
  const totals = new Map<number, number>();
  for (const step of steps) {
    let target = index + step.offset;
    if (target < 0) {
      if (!fold) continue;
      target = 0;
    }
    if (target > maxIndex) {
      if (!fold) continue;
      target = maxIndex;
    }
    totals.set(target, (totals.get(target) ?? 0) + step.weight);
  }
  return [...totals.entries()]
    .sort(([left], [right]) => left - right)
    .map(([realmIndex, weight]) => ({
      realm: REALM_VALUES[realmIndex]!,
      level: EQUIPMENT_LEVELS[realmIndex]!,
      weight,
    }));
}

/** 同一境界的六部位等权。返回值的权重之和等于各境界权重之和乘以部位数。 */
export function blueprintDropEntries(
  realm: RealmType,
  profile: BlueprintDropProfile,
): { rewardId: string; weight: number }[] {
  return blueprintRealmWeights(realm, profile).flatMap((row) =>
    DAO_EQUIPMENT_SLOTS.map((slot) => ({
      rewardId: `blueprint.${slot}.${row.level}`,
      weight: row.weight,
    })),
  );
}
