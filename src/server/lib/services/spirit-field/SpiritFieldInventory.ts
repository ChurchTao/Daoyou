import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import { SeedFactsSchema } from '@shared/items/definitions/seeds';
import { materialFactsOf } from '@shared/items/material';
import { findItemDefinition } from '@shared/items/registry';
import { isPillConsumable } from '@shared/lib/consumables';
import { and, eq } from 'drizzle-orm';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '../../drizzle/db';
import { inventoryItems } from '../../drizzle/schema';
import {
  assertInventoryIdle,
  inventoryItemOf,
  saveInventoryPlan,
} from '../InventoryService';
import { SpiritFieldServiceError } from './SpiritFieldService';

export async function readFieldBag(
  owner: string,
  q: DbExecutor | DbTransaction = getExecutor(),
) {
  return (
    await q
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.cultivatorId, owner),
          eq(inventoryItems.location, 'bag'),
        ),
      )
  ).map(inventoryItemOf);
}
export function fieldResource(
  item: Awaited<ReturnType<typeof readFieldBag>>[number],
) {
  const kind = findItemDefinition(item.definitionId)?.kind;
  if (kind === 'seed') {
    const spec = SeedFactsSchema.parse(item.instanceData).seedSpec;
    return {
      id: item.id,
      revision: item.revision,
      quantity: item.quantity,
      kind: 'seed',
      name: spec.plant.seedName,
      quality: spec.plant.quality,
      spec,
    };
  }
  if (kind === 'material') {
    const facts = materialFactsOf(item.definitionId, item.instanceData);
    return {
      id: item.id,
      revision: item.revision,
      quantity: item.quantity,
      kind: facts.type,
      name: facts.name,
      quality: facts.rank,
    };
  }
  if (kind === 'consumable') {
    const facts = ConsumableFactsSchema.parse(item.instanceData);
    if (isPillConsumable({ ...facts, quantity: item.quantity }))
      return {
        id: item.id,
        revision: item.revision,
        quantity: item.quantity,
        kind: 'pill',
        name: facts.name,
        quality: facts.quality,
      };
  }
  return null;
}
export async function consumeFieldItem(
  owner: string,
  id: string,
  revision: number,
  amount: number,
  tx: DbTransaction,
) {
  await assertInventoryIdle(owner);
  const before = await readFieldBag(owner, tx);
  const item = before.find((row) => row.id === id);
  if (
    !item ||
    item.revision !== revision ||
    item.quantity < amount ||
    !Number.isSafeInteger(amount) ||
    amount < 1
  )
    throw new SpiritFieldServiceError(
      '随身物品已变化或数量不足，请重新选择',
      409,
    );
  await saveInventoryPlan(
    owner,
    before,
    before.flatMap((row) =>
      row.id !== id
        ? [row]
        : row.quantity === amount
          ? []
          : [
              {
                ...row,
                quantity: row.quantity - amount,
                revision: row.revision + 1,
              },
            ],
    ),
    tx,
  );
}
