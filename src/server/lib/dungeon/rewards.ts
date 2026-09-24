import type { DbExecutor } from '@server/lib/drizzle/db';
import { generateRealmMaterials } from '@server/lib/services/MaterialRewardService';
import { MaterialFactsSchema } from '@shared/items/definitions/materials';
import {
  planDungeonReward,
  type DungeonRewardEntry,
  type DungeonRewardSource,
} from '@shared/rewards/dungeon';

/** Resolve library facts before recording rewards; retries reuse recorded facts. */
export async function resolveDungeonReward(
  seed: number,
  key: string,
  source: DungeonRewardSource,
  level: number,
  previous: DungeonRewardEntry[] = [],
  executor?: DbExecutor,
): Promise<DungeonRewardEntry> {
  const existing = previous.find((reward) => reward.key === key);
  if (existing) return existing;
  const plan = planDungeonReward(seed, key, source, level);
  const materials = await generateRealmMaterials(
    plan.materialRealm,
    plan.materialCount,
    plan.materialSeed,
    true,
    executor,
  );
  return {
    key,
    experience: plan.experience,
    spiritStones: plan.spiritStones,
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
  };
}
