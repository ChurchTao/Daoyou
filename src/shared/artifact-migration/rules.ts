import { QI_RESTORE_TALISMAN_SCENARIOS } from '../config/qiSystem';
import type { ArtifactMigrationPlan } from '../contracts/artifactMigration';
import { EQUIPMENT_LEVELS } from '../engine/combat-v6/equipment/realm';
import { DAO_EQUIPMENT_SLOTS } from '../engine/combat-v6/equipment/types';
import { ConsumableFactsSchema } from '../items/definitions/consumables';
import { legacyRecord } from '../legacy/products';
import { REALM_VALUES, type RealmType } from '../types/constants';

const smallQiTalisman = QI_RESTORE_TALISMAN_SCENARIOS.qi_restore_small;
export const artifactMigrationTalismanFacts = ConsumableFactsSchema.parse({
  name: smallQiTalisman.label,
  type: '符箓',
  quality: '凡品',
  description: `聚拢天地清气的符箓，使用后恢复${smallQiTalisman.amount}点天地灵气。`,
  spec: {
    kind: 'talisman',
    scenario: 'qi_restore_small',
    sessionMode: 'consume_on_action',
  },
});

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
): Pick<
  ArtifactMigrationPlan,
  'anchorRealm' | 'realm' | 'equipmentLevel' | 'fallback'
> {
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
  quality: string | null;
  score: number;
  productModel: unknown;
}): ArtifactMigrationPlan {
  return {
    ...artifactMigrationRealm(source.productModel),
    blueprints: artifactBlueprintCount(source.score),
    spiritStones: source.quality === '神品' ? 500_000 : 0,
    bonusGrants:
      source.quality === '神品'
        ? [
            {
              definitionId: 'consumable.v1',
              quantity: 1,
              instanceData: artifactMigrationTalismanFacts,
            },
          ]
        : [],
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
