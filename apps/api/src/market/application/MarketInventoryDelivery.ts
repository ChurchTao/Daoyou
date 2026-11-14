import type { Material } from '@daoyou/game-domain/character';
import {
  MaterialFactsSchema,
  seedFactsOf,
} from '@daoyou/game-domain/inventory';
import { isSpiritGardenSeed } from '@daoyou/game-rules/spirit-field';
import { grantInventory } from '@server/inventory/operations.js';
import type { DbTransaction } from '@server/lib/drizzle/db.js';

/** New market seed stock must belong to the current garden catalog. */
export async function deliverMarketMaterial(
  owner: string,
  material: Pick<
    Material,
    'name' | 'type' | 'rank' | 'element' | 'description' | 'details'
  >,
  tx: DbTransaction,
  quantity = 1,
) {
  const facts =
    material.type === 'seed'
      ? seedFactsOf(material)
      : MaterialFactsSchema.parse({
          name: material.name,
          type: material.type,
          rank: material.rank,
          element: material.element ?? null,
          description: material.description ?? '',
        });
  if (
    material.type === 'seed' &&
    !isSpiritGardenSeed(seedFactsOf(material).seedSpec.plant)
  )
    throw new Error('旧版灵种已停止出售，请刷新货架');
  const [item] = await grantInventory(
    owner,
    [
      {
        definitionId: material.type === 'seed' ? 'seed.v1' : 'material.v1',
        quantity,
        instanceData: facts,
      },
    ],
    tx,
  );
  if (!item) throw new Error('购入材料入库失败');
  return item;
}
