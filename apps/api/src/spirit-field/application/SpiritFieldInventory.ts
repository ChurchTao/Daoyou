import {
  ConsumableFactsSchema,
  SeedFactsSchema,
  materialFactsOf,
} from '@daoyou/game-domain/inventory';
import { findItemDefinition } from '@daoyou/game-content/items';
import { isPillConsumable } from '@daoyou/game-domain/consumables';
import { and, eq, or } from 'drizzle-orm';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import { inventoryItems } from '@server/lib/drizzle/schema.js';
import {
  assertInventoryIdle,
  inventoryItemOf,
  saveInventoryPlan,
} from '@server/inventory/operations.js';
import { SpiritFieldServiceError } from '@server/spirit-field/application/SpiritFieldError.js';

export async function readFieldBag(
  owner: string,
  q: DbExecutor | DbTransaction = getExecutor(),
  selectedId?: string,
) {
  return (
    await q
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.cultivatorId, owner),
          or(
            eq(inventoryItems.location, 'bag'),
            selectedId
              ? and(
                  eq(inventoryItems.location, 'storage'),
                  eq(inventoryItems.id, selectedId),
                )
              : undefined,
          ),
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
    const facts = materialFactsOf(item.instanceData);
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
  await assertInventoryIdle(owner, tx);
  const before = await readFieldBag(owner, tx, id);
  const item = before.find((row) => row.id === id);
  if (
    !item ||
    item.revision !== revision ||
    item.quantity < amount ||
    !Number.isSafeInteger(amount) ||
    amount < 1
  )
    throw new SpiritFieldServiceError(
      '所选物品已变化或数量不足，请重新选择',
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
