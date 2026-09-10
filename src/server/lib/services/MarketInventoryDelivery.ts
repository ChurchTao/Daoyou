import type { DbTransaction } from '@server/lib/drizzle/db';
import { MaterialFactsSchema } from '@shared/items/definitions/materials';
import type { Material } from '@shared/types/cultivator';
import { grantInventory } from './InventoryService';

/** Market materials enter the same inventory as crafting output. Seeds stay with the field. */
export async function deliverMarketMaterial(
  owner: string,
  material: Pick<
    Material,
    'name' | 'type' | 'rank' | 'element' | 'description'
  >,
  tx: DbTransaction,
) {
  const facts = MaterialFactsSchema.parse({
    name: material.name,
    type: material.type,
    rank: material.rank,
    element: material.element ?? null,
    description: material.description ?? '',
  });
  const [item] = await grantInventory(
    owner,
    [{ definitionId: 'material.v1', quantity: 1, instanceData: facts }],
    tx,
  );
  if (!item) throw new Error('购入材料入库失败');
  return item;
}
