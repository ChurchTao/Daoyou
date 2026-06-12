import { getExecutor, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import {
  cultivators,
  itemLibrary,
  reputationShopItems,
  reputationShopPurchases,
} from '@server/lib/drizzle/schema';
import { findPublishedItemLibraryByItemIds } from '@server/lib/repositories/itemLibraryRepository';
import { resourceEngine } from '@shared/engine/resource/ResourceEngine';
import type { ResourceOperation } from '@shared/engine/resource/types';
import {
  REPUTATION_SHOP_MAX_PRICE,
  REPUTATION_SHOP_MAX_STACK_QUANTITY,
  type ReputationShopItemMutation,
  type ReputationShopItemStatus,
  type ReputationShopItemView,
} from '@shared/contracts/reputationShop';
import {
  attachmentsToResourceOperations,
  buildAttachmentFromItemLibraryEntry,
  parseItemLibraryEntry,
  type ItemLibraryEntry,
} from '@shared/lib/itemLibrary';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';

type ShopItemRow = typeof reputationShopItems.$inferSelect;
type ItemLibraryRow = typeof itemLibrary.$inferSelect;
const PURCHASE_WEEK_TIME_ZONE = 'Asia/Shanghai';

export class ReputationShopError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function getReputationShopPurchaseWeek(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PURCHASE_WEEK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(value.year);
  const month = Number(value.month);
  const day = Number(value.day);
  const localDate = new Date(Date.UTC(year, month - 1, day));
  const dayOffset = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - dayOffset);
  return localDate.toISOString().slice(0, 10);
}

function parseItem(row: ItemLibraryRow): ItemLibraryEntry {
  return parseItemLibraryEntry({
    id: row.id,
    itemId: row.itemId,
    type: row.type,
    status: row.status,
    name: row.name,
    description: row.description,
    quality: row.quality,
    element: row.element,
    category: row.category,
    payload: row.payload,
    editorConfig: row.editorConfig,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

async function countPurchases(
  cultivatorId: string,
  shopItemId: string,
  purchaseWeek: string,
  q: DbExecutor | DbTransaction,
): Promise<number> {
  const [row] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(reputationShopPurchases)
    .where(
      and(
        eq(reputationShopPurchases.cultivatorId, cultivatorId),
        eq(reputationShopPurchases.shopItemId, shopItemId),
        eq(reputationShopPurchases.purchaseWeek, purchaseWeek),
      ),
    );

  return Number(row?.count ?? 0);
}

async function buildView(args: {
  row: ShopItemRow;
  item: ItemLibraryRow;
  cultivatorId?: string;
  q: DbExecutor | DbTransaction;
}): Promise<ReputationShopItemView> {
  const purchaseWeek = getReputationShopPurchaseWeek();
  const purchasedCount = args.cultivatorId
    ? await countPurchases(args.cultivatorId, args.row.id, purchaseWeek, args.q)
    : 0;
  const remainingPurchases =
    typeof args.row.perUserLimit === 'number'
      ? Math.max(0, args.row.perUserLimit - purchasedCount)
      : null;

  return {
    id: args.row.id,
    itemLibraryItemId: args.row.itemLibraryItemId,
    price: args.row.price,
    quantity: args.row.quantity,
    perUserLimit: args.row.perUserLimit,
    status: args.row.status as ReputationShopItemStatus,
    sortOrder: args.row.sortOrder,
    purchasedCount,
    remainingPurchases,
    item: parseItem(args.item),
    createdAt: toIso(args.row.createdAt),
    updatedAt: toIso(args.row.updatedAt),
  };
}

async function loadShopItemWithLibrary(
  id: string,
  q: DbExecutor | DbTransaction,
): Promise<{ row: ShopItemRow; item: ItemLibraryRow } | null> {
  const [result] = await q
    .select({ row: reputationShopItems, item: itemLibrary })
    .from(reputationShopItems)
    .innerJoin(
      itemLibrary,
      eq(reputationShopItems.itemLibraryItemId, itemLibrary.itemId),
    )
    .where(eq(reputationShopItems.id, id))
    .limit(1);

  return result ?? null;
}

export async function listReputationShopItems(args: {
  cultivatorId?: string;
  status?: ReputationShopItemStatus;
  userVisibleOnly?: boolean;
  q?: DbExecutor | DbTransaction;
} = {}): Promise<ReputationShopItemView[]> {
  const q = args.q ?? getExecutor();
  const whereConditions: SQL<unknown>[] = [];
  if (args.status) {
    whereConditions.push(eq(reputationShopItems.status, args.status));
  }
  if (args.userVisibleOnly) {
    whereConditions.push(eq(reputationShopItems.status, 'active'));
    whereConditions.push(eq(itemLibrary.status, 'published'));
  }

  const query = q
    .select({ row: reputationShopItems, item: itemLibrary })
    .from(reputationShopItems)
    .innerJoin(
      itemLibrary,
      eq(reputationShopItems.itemLibraryItemId, itemLibrary.itemId),
    )
    .orderBy(
      asc(reputationShopItems.sortOrder),
      desc(reputationShopItems.updatedAt),
    );

  const rows =
    whereConditions.length > 0
      ? await query.where(and(...whereConditions))
      : await query;

  return Promise.all(
    rows.map((entry) =>
      buildView({
        row: entry.row,
        item: entry.item,
        cultivatorId: args.cultivatorId,
        q,
      }),
    ),
  );
}

function assertQuantityForItemType(args: {
  itemType: ItemLibraryEntry['type'] | ItemLibraryRow['type'];
  quantity: number;
}): void {
  if (!Number.isInteger(args.quantity) || args.quantity < 1) {
    throw new ReputationShopError(400, '商品发放数量配置异常');
  }
  if (args.itemType === 'artifact' && args.quantity !== 1) {
    throw new ReputationShopError(400, '法宝类商品每次只能发放 1 件');
  }
  if (
    args.itemType !== 'artifact' &&
    args.quantity > REPUTATION_SHOP_MAX_STACK_QUANTITY
  ) {
    throw new ReputationShopError(
      400,
      `材料和消耗品每次最多发放 ${REPUTATION_SHOP_MAX_STACK_QUANTITY} 件`,
    );
  }
}

function assertStoredShopItem(row: ShopItemRow, item: ItemLibraryRow): void {
  if (row.status !== 'active' || item.status !== 'published') {
    throw new ReputationShopError(400, '此物暂不可兑换');
  }
  if (!Number.isInteger(row.price) || row.price < 1) {
    throw new ReputationShopError(400, '商品声望价格配置异常');
  }
  if (row.price > REPUTATION_SHOP_MAX_PRICE) {
    throw new ReputationShopError(
      400,
      `商品声望价格不能超过 ${REPUTATION_SHOP_MAX_PRICE}`,
    );
  }
  if (
    row.perUserLimit !== null &&
    (!Number.isInteger(row.perUserLimit) || row.perUserLimit < 1)
  ) {
    throw new ReputationShopError(400, '商品每周限购配置异常');
  }
  assertQuantityForItemType({
    itemType: item.type,
    quantity: row.quantity,
  });
}

async function assertPublishedItemAndQuantity(input: {
  itemLibraryItemId: string;
  quantity: number;
}): Promise<void> {
  const [item] = await findPublishedItemLibraryByItemIds([
    input.itemLibraryItemId,
  ]);
  if (!item) {
    throw new ReputationShopError(400, '请选择已发布的道具库道具');
  }
  assertQuantityForItemType({
    itemType: item.type,
    quantity: input.quantity,
  });
}

export async function createReputationShopItem(params: {
  input: ReputationShopItemMutation;
  userId: string;
}): Promise<ReputationShopItemView> {
  await assertPublishedItemAndQuantity(params.input);
  const q = getExecutor();
  const [row] = await q
    .insert(reputationShopItems)
    .values({
      itemLibraryItemId: params.input.itemLibraryItemId,
      price: params.input.price,
      quantity: params.input.quantity,
      perUserLimit: params.input.perUserLimit ?? null,
      status: params.input.status,
      sortOrder: params.input.sortOrder,
      createdBy: params.userId,
      updatedBy: params.userId,
    })
    .returning();

  const loaded = await loadShopItemWithLibrary(row.id, q);
  if (!loaded) throw new Error('声望商店商品创建后读取失败');
  return buildView({ ...loaded, q });
}

export async function updateReputationShopItem(params: {
  id: string;
  input: ReputationShopItemMutation;
  userId: string;
}): Promise<ReputationShopItemView | null> {
  await assertPublishedItemAndQuantity(params.input);
  const q = getExecutor();
  const [row] = await q
    .update(reputationShopItems)
    .set({
      itemLibraryItemId: params.input.itemLibraryItemId,
      price: params.input.price,
      quantity: params.input.quantity,
      perUserLimit: params.input.perUserLimit ?? null,
      status: params.input.status,
      sortOrder: params.input.sortOrder,
      updatedBy: params.userId,
      updatedAt: new Date(),
    })
    .where(eq(reputationShopItems.id, params.id))
    .returning();

  if (!row) return null;
  const loaded = await loadShopItemWithLibrary(row.id, q);
  if (!loaded) return null;
  return buildView({ ...loaded, q });
}

export async function archiveReputationShopItem(params: {
  id: string;
  userId: string;
}): Promise<ReputationShopItemView | null> {
  const q = getExecutor();
  const [row] = await q
    .update(reputationShopItems)
    .set({
      status: 'archived',
      updatedBy: params.userId,
      updatedAt: new Date(),
    })
    .where(eq(reputationShopItems.id, params.id))
    .returning();

  if (!row) return null;
  const loaded = await loadShopItemWithLibrary(row.id, q);
  if (!loaded) return null;
  return buildView({ ...loaded, q });
}

export async function buyReputationShopItem(params: {
  id: string;
  userId: string;
  cultivatorId: string;
  tx: DbTransaction;
}): Promise<{
  item: ReputationShopItemView;
  reputation: number;
  gains: ResourceOperation[];
}> {
  const loaded = await loadShopItemWithLibrary(params.id, params.tx);
  if (!loaded) {
    throw new ReputationShopError(404, '天骄宝阁商品不存在');
  }
  assertStoredShopItem(loaded.row, loaded.item);

  const purchaseWeek = getReputationShopPurchaseWeek();
  const purchasedCount = await countPurchases(
    params.cultivatorId,
    loaded.row.id,
    purchaseWeek,
    params.tx,
  );
  if (
    typeof loaded.row.perUserLimit === 'number' &&
    purchasedCount >= loaded.row.perUserLimit
  ) {
    throw new ReputationShopError(400, '此物已达兑换上限');
  }

  const consumeResult = await resourceEngine.consumeInTransaction(
    params.userId,
    params.cultivatorId,
    [{ type: 'reputation', value: loaded.row.price }],
    params.tx,
  );
  if (!consumeResult.success) {
    throw new ReputationShopError(400, consumeResult.errors?.[0] ?? '声望不足');
  }

  const attachment = buildAttachmentFromItemLibraryEntry(
    parseItem(loaded.item),
    loaded.row.quantity,
  );
  const gains = attachmentsToResourceOperations([attachment]);
  const gainResult = await resourceEngine.gainInTransaction(
    params.userId,
    params.cultivatorId,
    gains,
    params.tx,
  );
  if (!gainResult.success) {
    throw new ReputationShopError(400, gainResult.errors?.[0] ?? '道具发放失败');
  }

  await params.tx.insert(reputationShopPurchases).values({
    shopItemId: loaded.row.id,
    cultivatorId: params.cultivatorId,
    itemLibraryItemId: loaded.row.itemLibraryItemId,
    quantity: loaded.row.quantity,
    reputationCost: loaded.row.price,
    purchaseWeek,
  });

  const [cultivatorRow] = await params.tx
    .select({ reputation: cultivators.reputation })
    .from(cultivators)
    .where(eq(cultivators.id, params.cultivatorId))
    .limit(1);

  return {
    item: await buildView({
      row: loaded.row,
      item: loaded.item,
      cultivatorId: params.cultivatorId,
      q: params.tx,
    }),
    reputation: cultivatorRow?.reputation ?? 0,
    gains,
  };
}
