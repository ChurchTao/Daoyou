import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import { cultivators, inventoryItems } from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import type {
  RecycleQuote,
  RecycleResult,
  RecycleSelection,
} from '@shared/contracts/recycle';
import { recycleBlockingReason } from '@shared/inventory/recycle';
import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import { materialFactsOf } from '@shared/items/material';
import { QUALITY_ORDER } from '@shared/types/constants';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { playerCommandExecutor } from './CommandExecutors';
import { inventoryItemOf, saveInventoryPlan } from './InventoryService';
import {
  MarketRecycleError,
  buildMaterialHighTierAppraisal,
  calculateHighTierUnitPrice,
  calculateLowTierUnitPrice,
  calculatePillRecycleUnitPrice,
} from './MarketRecycleService';

const key = (owner: string, id: string) => `market:bag-recycle:${owner}:${id}`;
async function selectedItems(
  owner: string,
  selection: RecycleSelection[],
  q: DbExecutor = getExecutor(),
) {
  const rows = (
    await q
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.cultivatorId, owner),
          inArray(
            inventoryItems.id,
            selection.map((item) => item.id),
          ),
        ),
      )
  ).map(inventoryItemOf);
  return selection.map((ref) => {
    const item = rows.find((row) => row.id === ref.id);
    if (!item || item.revision !== ref.revision || item.quantity < ref.quantity)
      throw new MarketRecycleError(409, '物品已变化，请重新选择并报价。');
    const reason = recycleBlockingReason(item);
    if (reason) throw new MarketRecycleError(409, reason);
    return item;
  });
}

export async function previewBagRecycle(
  owner: string,
  selection: RecycleSelection[],
) {
  const snapshots = await selectedItems(owner, selection);
  const items = snapshots.map((item, index) => {
    const ref = selection[index];
    if (item.definitionId === 'consumable.v1') {
      const facts = ConsumableFactsSchema.parse(item.instanceData);
      return {
        ...ref,
        name: facts.name,
        unitPrice: calculatePillRecycleUnitPrice(facts),
      };
    }
    const material = materialFactsOf(item.definitionId, item.instanceData);
    const appraisal =
      QUALITY_ORDER[material.rank] >= QUALITY_ORDER.真品
        ? buildMaterialHighTierAppraisal({
            ...material,
            element: material.element ?? undefined,
          })
        : undefined;
    return {
      ...ref,
      name: material.name,
      unitPrice: appraisal
        ? calculateHighTierUnitPrice(material, appraisal)
        : calculateLowTierUnitPrice(material),
      ...(appraisal ? { comment: appraisal.comment } : {}),
    };
  });
  const total = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );
  if (!Number.isSafeInteger(total) || total < 1 || total > 2147483647)
    throw new MarketRecycleError(400, '这批物品暂时无法估价。');
  const quote: RecycleQuote = {
    id: randomUUID(),
    expiresAt: Date.now() + 600_000,
    items,
    total,
  };
  await redis.set(
    key(owner, quote.id),
    JSON.stringify({ quote, snapshots }),
    'EX',
    600,
  );
  return quote;
}

export function confirmBagRecycle(
  actor: { userId: string; cultivatorId: string },
  quoteId: string,
) {
  return playerCommandExecutor.executeWithLock<RecycleResult>({
    ...actor,
    source: 'bag_recycle',
    idempotency: { key: `bag-recycle:${quoteId}`, fingerprint: quoteId },
    command: async (tx) => {
      const raw = await redis.get(key(actor.cultivatorId, quoteId));
      if (!raw)
        throw new MarketRecycleError(410, '这份报价已过期，请重新询价。');
      const stored = JSON.parse(raw) as {
        quote: RecycleQuote;
        snapshots: Awaited<ReturnType<typeof selectedItems>>;
      };
      if (stored.quote.expiresAt < Date.now())
        throw new MarketRecycleError(410, '这份报价已过期，请重新询价。');
      const before = await selectedItems(
        actor.cultivatorId,
        stored.quote.items,
        tx,
      );
      if (JSON.stringify(before) !== JSON.stringify(stored.snapshots))
        throw new MarketRecycleError(409, '物品已变化，请重新询价。');
      const after = before.flatMap((item, index) => {
        const quantity = item.quantity - stored.quote.items[index].quantity;
        return quantity
          ? [{ ...item, quantity, revision: item.revision + 1 }]
          : [];
      });
      await saveInventoryPlan(actor.cultivatorId, before, after, tx);
      const [currency] = await tx
        .update(cultivators)
        .set({
          spirit_stones: sql`${cultivators.spirit_stones} + ${stored.quote.total}`,
        })
        .where(
          and(
            eq(cultivators.id, actor.cultivatorId),
            eq(cultivators.userId, actor.userId),
            sql`${cultivators.spirit_stones}::bigint + ${stored.quote.total} <= 2147483647`,
          ),
        )
        .returning({ spiritStones: cultivators.spirit_stones });
      if (!currency)
        throw new MarketRecycleError(
          409,
          '灵石已达存储上限，请减少本次出售数量。',
        );
      return {
        result: {
          total: stored.quote.total,
          quantity: stored.quote.items.reduce(
            (sum, item) => sum + item.quantity,
            0,
          ),
          remainingSpiritStones: currency.spiritStones,
        },
        resourceChanges: [
          {
            resourceTopic: 'player.currency',
            eventType: 'currency.market.gained',
            operation: 'merge',
            payload: currency,
          },
        ],
      };
    },
  });
}
