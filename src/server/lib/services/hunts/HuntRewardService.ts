import type { DbExecutor } from '@server/lib/drizzle/db';
import type { HuntEvent } from '@shared/hunts/config';
import { MaterialFactsSchema } from '@shared/items/definitions/materials';
import { HuntRewardSnapshotSchema, planHuntReward } from '@shared/rewards/hunt';
import { HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM } from '@shared/rewards/hunt-material-quality';
import { generateRealmMaterials } from '../MaterialRewardService';
import { computeItemLibrarySampleKey } from '../itemLibrarySampleKey';

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
