import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import { inventoryItems } from '@server/lib/drizzle/schema';
import {
  groupAlchemyBagMaterials,
  type AlchemyBagMaterial,
} from '@shared/inventory/alchemy';
import { inventoryStackIdentity } from '@shared/inventory/stack-key';
import { consumableFactsOf } from '@shared/items/definitions/consumables';
import type { Consumable } from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';
import { AlchemyServiceError } from '../AlchemyServiceError';
import {
  grantInventory,
  inventoryItemOf,
  saveInventoryPlan,
} from '../InventoryService';

export async function readAlchemyMaterials(
  owner: string,
  q: DbExecutor | DbTransaction = getExecutor(),
) {
  const rows = await q
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.cultivatorId, owner),
        eq(inventoryItems.location, 'bag'),
      ),
    );
  return groupAlchemyBagMaterials(rows.map(inventoryItemOf));
}
export async function loadAlchemyMaterials(
  owner: string,
  ids: string[],
  q?: DbExecutor | DbTransaction,
) {
  const groups = await readAlchemyMaterials(owner, q);
  if (new Set(ids).size !== ids.length || ids.length < 1 || ids.length > 6)
    throw new AlchemyServiceError('请选择一至六种不同材料。');
  return ids.map((id) => {
    const item = groups.find((g) => g.id === id);
    if (!item)
      throw new AlchemyServiceError('部分随身材料已变化，请重新备料。', 409);
    return item;
  });
}
export async function assertAlchemyMaterialVersions(
  owner: string,
  ids: string[],
  versions: Record<string, string>,
  q?: DbExecutor | DbTransaction,
) {
  const items = await loadAlchemyMaterials(owner, ids, q);
  if (items.some((item) => versions[item.id] !== JSON.stringify(item.members)))
    throw new AlchemyServiceError('随身材料已变化，请刷新并重新投入。', 409);
}
export async function consumeAlchemyMaterials(
  owner: string,
  expected: AlchemyBagMaterial[],
  doses: { id: string; dose: number }[],
  tx: DbTransaction,
) {
  const before = (
    await tx
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.cultivatorId, owner),
          eq(inventoryItems.location, 'bag'),
        ),
      )
  ).map(inventoryItemOf);
  const current = groupAlchemyBagMaterials(before);
  const consumed = new Map<string, number>();
  for (const group of expected) {
    if (
      JSON.stringify(current.find((g) => g.id === group.id)) !==
      JSON.stringify(group)
    )
      throw new AlchemyServiceError('材料已发生变化，请重新确认配方。', 409);
    let remaining = doses.find((d) => d.id === group.id)?.dose ?? 0;
    if (
      !Number.isInteger(remaining) ||
      remaining < 1 ||
      remaining > group.quantity
    )
      throw new AlchemyServiceError('材料数量不足。', 409);
    for (const member of group.members) {
      const amount = Math.min(member.quantity, remaining);
      if (amount) consumed.set(member.id, amount);
      remaining -= amount;
    }
  }
  await saveInventoryPlan(
    owner,
    before,
    before.flatMap((item) => {
      const amount = consumed.get(item.id) ?? 0;
      return item.quantity === amount
        ? []
        : [
            {
              ...item,
              quantity: item.quantity - amount,
              revision: item.revision + (amount ? 1 : 0),
            },
          ];
    }),
    tx,
  );
}
export async function grantAlchemyOutput(
  owner: string,
  outputs: Consumable[],
  tx: DbTransaction,
) {
  const saved = await grantInventory(
    owner,
    outputs.map((output) => ({
      definitionId: 'consumable.v1',
      quantity: output.quantity,
      instanceData: consumableFactsOf(output),
    })),
    tx,
  );
  return outputs.map((output) => ({
    ...output,
    id: saved.find(
      (item) =>
        inventoryStackIdentity(item.definitionId, item.instanceData) ===
        inventoryStackIdentity('consumable.v1', consumableFactsOf(output)),
    )!.id,
  }));
}
