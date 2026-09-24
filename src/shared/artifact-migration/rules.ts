import type { ArtifactMigrationPlan } from '../contracts/artifactMigration';
import { EQUIPMENT_LEVELS } from '../engine/combat-v6/equipment/realm';
import { DAO_EQUIPMENT_SLOTS } from '../engine/combat-v6/equipment/types';
import { legacyRecord } from '../legacy/products';
import { REALM_VALUES, type RealmType } from '../types/constants';

/** Scores affect blueprint quantity only; every valid source grants one equipment. */
export function artifactBlueprintCount(score: number): number {
  if (!Number.isSafeInteger(score) || score <= 0)
    throw new Error('旧法宝评分异常，请联系管理员核对');
  return score >= 4000
    ? 4
    : score >= 3500
      ? 3
      : score >= 3000
        ? 2
        : score >= 2000
          ? 1
          : 0;
}
export function artifactMigrationRealm(
  productModel: unknown,
): Omit<ArtifactMigrationPlan, 'blueprints'> {
  const anchor = legacyRecord(legacyRecord(productModel).metadata).anchorRealm;
  const index = REALM_VALUES.indexOf(anchor as RealmType);
  const normalizedIndex = index < 0 ? 2 : Math.min(index, 4);
  return {
    anchorRealm: index < 0 ? null : REALM_VALUES[index],
    realm: REALM_VALUES[normalizedIndex],
    equipmentLevel: EQUIPMENT_LEVELS[normalizedIndex],
    fallback: index < 0,
  };
}
export function artifactMigrationPlan(source: {
  score: number;
  productModel: unknown;
}): ArtifactMigrationPlan {
  return {
    ...artifactMigrationRealm(source.productModel),
    blueprints: artifactBlueprintCount(source.score),
  };
}
export function drawArtifactBlueprints(
  plan: ArtifactMigrationPlan,
  random: () => number,
) {
  const grants = new Map<string, number>();
  for (let i = 0; i < plan.blueprints; i++) {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1)
      throw new Error('图纸随机值无效');
    const slot =
      DAO_EQUIPMENT_SLOTS[Math.floor(value * DAO_EQUIPMENT_SLOTS.length)];
    const definitionId = `blueprint.${slot}.${plan.equipmentLevel}`;
    grants.set(definitionId, (grants.get(definitionId) ?? 0) + 1);
  }
  return Array.from(grants, ([definitionId, quantity]) => ({
    definitionId,
    quantity,
  }));
}
