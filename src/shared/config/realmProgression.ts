import {
  REALM_STAGE_VALUES,
  REALM_VALUES,
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';

export const BASE_ATTRIBUTE_VALUE = 10;
export const ATTRIBUTE_KEY_COUNT = 6;
export const BASE_ATTRIBUTE_TOTAL =
  BASE_ATTRIBUTE_VALUE * ATTRIBUTE_KEY_COUNT;
export const LEVELS_PER_REALM_STAGE = 5;
export const NATURAL_ATTRIBUTE_GAIN_PER_LEVEL = 1;
export const FREE_ATTRIBUTE_POINTS_PER_LEVEL = 5;

export function getRealmStageLevel(realm: RealmType, stage: RealmStage): number {
  return (getRealmStageRank(realm, stage) + 1) * LEVELS_PER_REALM_STAGE;
}

export function getRealmStageRank(
  realm: RealmType,
  stage: RealmStage,
): number {
  const realmIndex = REALM_VALUES.indexOf(realm);
  const stageIndex = REALM_STAGE_VALUES.indexOf(stage);
  return Math.max(0, realmIndex) * REALM_STAGE_VALUES.length + Math.max(0, stageIndex);
}

export function getRealmStageAttributeBudget(
  realm: RealmType,
  stage: RealmStage,
): number {
  return (
    getRealmStageNaturalAttributeValue(realm, stage) * ATTRIBUTE_KEY_COUNT +
    getRealmStageUnallocatedAttributeBudget(realm, stage)
  );
}

export function getRealmStageNaturalAttributeValue(
  realm: RealmType,
  stage: RealmStage,
): number {
  return BASE_ATTRIBUTE_VALUE +
    getRealmStageLevel(realm, stage) * NATURAL_ATTRIBUTE_GAIN_PER_LEVEL;
}

export function getRealmStageUnallocatedAttributeBudget(
  realm: RealmType,
  stage: RealmStage,
): number {
  return getRealmStageLevel(realm, stage) * FREE_ATTRIBUTE_POINTS_PER_LEVEL;
}

export function getBreakthroughAttributeGrowthReward(
  from: { realm: RealmType; stage: RealmStage },
  to: { realm: RealmType; stage: RealmStage },
): { naturalPerAttribute: number; attributePointReward: number } {
  return {
    naturalPerAttribute:
      getRealmStageNaturalAttributeValue(to.realm, to.stage) -
      getRealmStageNaturalAttributeValue(from.realm, from.stage),
    attributePointReward:
      getRealmStageUnallocatedAttributeBudget(to.realm, to.stage) -
      getRealmStageUnallocatedAttributeBudget(from.realm, from.stage),
  };
}

export function getRealmDamagePressureMultiplier(delta: number): number {
  if (delta === 0) return 1;

  const absDelta = Math.abs(delta);
  if (delta > 0) {
    const highToLowByDelta: Record<number, number> = {
      1: 1.08,
      2: 1.16,
      3: 1.25,
      4: 1.4,
      5: 1.52,
      6: 1.64,
      7: 1.78,
      8: 1.95,
    };
    return Math.min(2.2, highToLowByDelta[absDelta] ?? 1.95 + (absDelta - 8) * 0.05);
  }

  const lowToHighByDelta: Record<number, number> = {
    1: 0.94,
    2: 0.88,
    3: 0.8,
    4: 0.68,
    5: 0.6,
    6: 0.52,
    7: 0.45,
    8: 0.38,
  };
  return Math.max(0.25, lowToHighByDelta[absDelta] ?? 0.38 - (absDelta - 8) * 0.03);
}

export function getRealmEffectChanceMultiplier(delta: number): number {
  if (delta > 0) return 1 + Math.min(0.35, delta * 0.04);
  if (delta < 0) return Math.max(0.55, 1 - Math.abs(delta) * 0.05);
  return 1;
}
