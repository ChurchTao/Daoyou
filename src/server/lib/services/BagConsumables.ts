import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import type { Consumable } from '@shared/types/cultivator';
import { and, asc, eq } from 'drizzle-orm';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '../drizzle/db';
import { inventoryItems } from '../drizzle/schema';
import { assertInventoryIdle } from './InventoryService';

export function bagConsumableOf(
  row: typeof inventoryItems.$inferSelect,
): Consumable & { id: string } {
  return {
    ...ConsumableFactsSchema.parse(row.instanceData),
    id: row.id,
    quantity: row.quantity,
  };
}
export async function readBagConsumables(
  owner: string,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<(Consumable & { id: string })[]> {
  return (
    await q
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.cultivatorId, owner),
          eq(inventoryItems.location, 'bag'),
          eq(inventoryItems.definitionId, 'consumable.v1'),
        ),
      )
      .orderBy(asc(inventoryItems.id))
  ).map(bagConsumableOf);
}
export async function getBagConsumable(
  owner: string,
  id: string,
  q?: DbExecutor | DbTransaction,
) {
  return (
    (await readBagConsumables(owner, q)).find((item) => item.id === id) ?? null
  );
}
export async function findBagTalisman(
  owner: string,
  scenario: string,
  q?: DbExecutor | DbTransaction,
  id?: string,
) {
  return (await readBagConsumables(owner, q)).filter(
    (item) =>
      (!id || item.id === id) &&
      item.spec.kind === 'talisman' &&
      item.spec.scenario === scenario,
  );
}
export async function consumeBagConsumable(
  owner: string,
  id: string,
  quantity: number,
  q: DbExecutor | DbTransaction,
) {
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new Error('消耗数量无效');
  const [row] = await q
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.cultivatorId, owner),
        eq(inventoryItems.id, id),
        eq(inventoryItems.location, 'bag'),
        eq(inventoryItems.definitionId, 'consumable.v1'),
      ),
    )
    .for('update');
  if (!row || row.quantity < quantity)
    throw new Error('随身消耗品不足，请先从洞府宝库或储藏室取出');
  await assertInventoryIdle(owner, bagConsumableOf(row), q);
  const filter = and(
    eq(inventoryItems.id, id),
    eq(inventoryItems.cultivatorId, owner),
    eq(inventoryItems.revision, row.revision),
  );
  const remainingQuantity = row.quantity - quantity;
  if (!remainingQuantity) await q.delete(inventoryItems).where(filter);
  else
    await q
      .update(inventoryItems)
      .set({ quantity: remainingQuantity, revision: row.revision + 1 })
      .where(filter);
  return {
    remainingQuantity,
    removed: !remainingQuantity,
    remaining: remainingQuantity
      ? { ...bagConsumableOf(row), quantity: remainingQuantity }
      : null,
  };
}
