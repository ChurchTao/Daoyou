import type { DbExecutor } from '@server/lib/drizzle/db.js';
import type { HuntEvent } from '@daoyou/game-domain/hunts';
import { MaterialFactsSchema } from '@daoyou/game-domain/inventory';
import { HuntRewardSnapshotSchema, planHuntReward } from '@daoyou/game-rules/rewards/hunt';
import { HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM } from '@daoyou/game-rules/rewards/materials';
import { generateRealmMaterials } from '@server/inventory/application/MaterialRewardService.js';
import { computeItemLibrarySampleKey } from '@server/lib/utils/itemLibrarySampleKey.js';

/** Freeze resources and library facts before combat; settlement never rerolls. */
export async function prepareHuntReward(
  event: HuntEvent,
  cultivatorId: string,
  tx: DbExecutor,
) {
  const seed = `${event.id}:${cultivatorId}`;
  const plan = planHuntReward(event, (stream) => {
    let index = 0;
    return () => computeItemLibrarySampleKey(`${seed}:${stream}:${index++}`);
  });
  const materials = await generateRealmMaterials(
    event.realm,
    plan.materialCount,
    `${seed}:${plan.poolId}:${plan.poolVersion}:materials`,
    true,
    tx,
    HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM[event.realm],
    true,
  );
  return HuntRewardSnapshotSchema.parse({
    poolId: plan.poolId,
    poolVersion: plan.poolVersion,
    experience: plan.experience,
    spiritStones: plan.spiritStones,
    insight: plan.insight,
    items: [
      ...plan.items,
      ...materials.map((material) => ({
        definitionId: 'material.v1',
        quantity: 1,
        instanceData: MaterialFactsSchema.parse({
          name: material.name,
          type: material.type,
          rank: material.rank,
          element: material.element ?? null,
          description: material.description ?? '',
        }),
      })),
    ],
  });
}
