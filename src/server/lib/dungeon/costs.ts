import type { ResourceOperation } from '@shared/engine/resource/types';
import { consumeDungeonMaterials } from '@shared/lib/dungeon/materialCosts';
import type { DungeonOptionCost } from '@shared/lib/dungeon/types';
import { and, eq } from 'drizzle-orm';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '../drizzle/db';
import { inventoryItems } from '../drizzle/schema';
import {
  inventoryItemOf,
  saveInventoryPlan,
} from '../services/InventoryService';
import { resourceEngine } from '../services/resource/ResourceEngine';

async function materialPlan(
  owner: string,
  costs: DungeonOptionCost[],
  q: DbExecutor,
) {
  const before = costs.some((cost) => cost.type === 'material')
    ? (
        await q
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.cultivatorId, owner),
              eq(inventoryItems.location, 'bag'),
            ),
          )
      ).map(inventoryItemOf)
    : [];
  return { before, after: consumeDungeonMaterials(before, costs) };
}
const resourceCosts = (costs: DungeonOptionCost[]) =>
  costs.filter((cost) => cost.type !== 'material') as ResourceOperation[];

export async function validateDungeonCosts(
  userId: string,
  owner: string,
  costs: DungeonOptionCost[],
) {
  await materialPlan(owner, costs, getExecutor());
  const validation = await resourceEngine.validate(
    userId,
    owner,
    resourceCosts(costs),
    getExecutor(),
  );
  if (!validation.valid)
    throw new Error(validation.errors?.join('; ') || '资源不足');
}

/** Caller holds the character lock; costs and the dungeon ledger commit in the same transaction. */
export async function applyDungeonCosts(
  userId: string,
  owner: string,
  costs: DungeonOptionCost[],
  tx: DbTransaction,
) {
  const { before, after } = await materialPlan(owner, costs, tx);
  const result = await resourceEngine.applyInTransaction({
    userId,
    cultivatorId: owner,
    consume: resourceCosts(costs),
    tx,
  });
  if (!result.success)
    throw new Error(result.errors?.join('; ') || '资源消耗失败');
  await saveInventoryPlan(owner, before, after, tx);
  return result;
}
