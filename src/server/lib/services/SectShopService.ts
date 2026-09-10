import {
  getExecutor,
  runDbTasks,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import {
  itemLibrary,
  sectShopItems,
  sectShopPurchases,
} from '@server/lib/drizzle/schema';
import { findPublishedItemLibraryByItemIds } from '@server/lib/repositories/itemLibraryRepository';
import type {
  SectShopItemData,
  SectShopItemMutation,
  SectShopItemStatus,
} from '@shared/contracts/sectShop';
import { SECT_SHOP_MAX_PRICE } from '@shared/contracts/sectShop';
import {
  getItemExchangePurchaseWeek,
  getItemExchangeQuantityError,
} from '@shared/lib/itemExchangeShop';
import {
  buildAttachmentFromItemLibraryEntry,
  parseItemLibraryEntry,
  type ItemLibraryEntry,
} from '@shared/lib/itemLibrary';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { assertInventoryIdle, grantInventory } from './InventoryService';
import { newRewardAttachment } from './MailInventory';

type ShopItemRow = typeof sectShopItems.$inferSelect;
type ItemLibraryRow = typeof itemLibrary.$inferSelect;

export class SectShopError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
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
    .from(sectShopPurchases)
    .where(
      and(
        eq(sectShopPurchases.cultivatorId, cultivatorId),
        eq(sectShopPurchases.shopItemId, shopItemId),
        eq(sectShopPurchases.purchaseWeek, purchaseWeek),
      ),
    );
  return Number(row?.count ?? 0);
}

async function buildView(args: {
  row: ShopItemRow;
  item: ItemLibraryRow;
  cultivatorId?: string;
  purchaseWeek?: string;
  q: DbExecutor | DbTransaction;
}): Promise<SectShopItemData> {
  const purchaseWeek = args.purchaseWeek ?? getItemExchangePurchaseWeek();
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
    status: args.row.status as SectShopItemStatus,
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
    .select({ row: sectShopItems, item: itemLibrary })
    .from(sectShopItems)
    .innerJoin(
      itemLibrary,
      eq(sectShopItems.itemLibraryItemId, itemLibrary.itemId),
    )
    .where(eq(sectShopItems.id, id))
    .limit(1);
  return result ?? null;
}

export async function listSectShopItems(
  args: {
    cultivatorId?: string;
    purchaseWeek?: string;
    status?: SectShopItemStatus;
    userVisibleOnly?: boolean;
    q?: DbExecutor | DbTransaction;
  } = {},
): Promise<SectShopItemData[]> {
  const q = args.q ?? getExecutor();
  const whereConditions: SQL<unknown>[] = [];
  if (args.status) whereConditions.push(eq(sectShopItems.status, args.status));
  if (args.userVisibleOnly) {
    whereConditions.push(eq(sectShopItems.status, 'active'));
    whereConditions.push(eq(itemLibrary.status, 'published'));
  }
  const query = q
    .select({ row: sectShopItems, item: itemLibrary })
    .from(sectShopItems)
    .innerJoin(
      itemLibrary,
      eq(sectShopItems.itemLibraryItemId, itemLibrary.itemId),
    )
    .orderBy(asc(sectShopItems.sortOrder), desc(sectShopItems.updatedAt));
  const rows =
    whereConditions.length > 0
      ? await query.where(and(...whereConditions))
      : await query;
  return runDbTasks(
    q,
    rows.map(
      (entry) => () =>
        buildView({
          row: entry.row,
          item: entry.item,
          cultivatorId: args.cultivatorId,
          purchaseWeek: args.purchaseWeek,
          q,
        }),
    ),
  );
}

function assertQuantity(itemType: string, quantity: number): void {
  const error = getItemExchangeQuantityError({ itemType, quantity });
  if (error) throw new SectShopError(400, error);
}

async function assertPublishedItem(input: SectShopItemMutation): Promise<void> {
  const [item] = await findPublishedItemLibraryByItemIds([
    input.itemLibraryItemId,
  ]);
  if (!item) throw new SectShopError(400, '请选择已发布的道具库道具');
  assertQuantity(item.type, input.quantity);
}

function assertPurchasable(row: ShopItemRow, item: ItemLibraryRow): void {
  if (row.status !== 'active' || item.status !== 'published') {
    throw new SectShopError(400, '此物暂不可兑换');
  }
  if (
    !Number.isInteger(row.price) ||
    row.price < 1 ||
    row.price > SECT_SHOP_MAX_PRICE
  ) {
    throw new SectShopError(400, '商品贡献价格配置异常');
  }
  if (
    row.perUserLimit !== null &&
    (!Number.isInteger(row.perUserLimit) || row.perUserLimit < 1)
  ) {
    throw new SectShopError(400, '商品每周限购配置异常');
  }
  assertQuantity(item.type, row.quantity);
}

export async function createSectShopItem(params: {
  input: SectShopItemMutation;
  userId: string;
}): Promise<SectShopItemData> {
  await assertPublishedItem(params.input);
  const q = getExecutor();
  const [row] = await q
    .insert(sectShopItems)
    .values({
      ...params.input,
      perUserLimit: params.input.perUserLimit ?? null,
      createdBy: params.userId,
      updatedBy: params.userId,
    })
    .returning();
  const loaded = await loadShopItemWithLibrary(row.id, q);
  if (!loaded) throw new Error('宗门宝库商品创建后读取失败');
  return buildView({ ...loaded, q });
}

export async function updateSectShopItem(params: {
  id: string;
  input: SectShopItemMutation;
  userId: string;
}): Promise<SectShopItemData | null> {
  await assertPublishedItem(params.input);
  const q = getExecutor();
  const [row] = await q
    .update(sectShopItems)
    .set({
      ...params.input,
      perUserLimit: params.input.perUserLimit ?? null,
      updatedBy: params.userId,
      updatedAt: new Date(),
    })
    .where(eq(sectShopItems.id, params.id))
    .returning();
  if (!row) return null;
  const loaded = await loadShopItemWithLibrary(row.id, q);
  return loaded ? buildView({ ...loaded, q }) : null;
}

export async function archiveSectShopItem(params: {
  id: string;
  userId: string;
}): Promise<SectShopItemData | null> {
  const q = getExecutor();
  const [row] = await q
    .update(sectShopItems)
    .set({
      status: 'archived',
      updatedBy: params.userId,
      updatedAt: new Date(),
    })
    .where(eq(sectShopItems.id, params.id))
    .returning();
  if (!row) return null;
  const loaded = await loadShopItemWithLibrary(row.id, q);
  return loaded ? buildView({ ...loaded, q }) : null;
}

export async function buySectShopItem(params: {
  id: string;
  userId: string;
  cultivatorId: string;
  membershipId: string;
  purchaseWeek: string;
  tx: DbTransaction;
  spendContribution: (cost: number) => Promise<void>;
}): Promise<{
  item: SectShopItemData;
  destinations: Array<'bag' | 'storage'>;
}> {
  const loaded = await loadShopItemWithLibrary(params.id, params.tx);
  if (!loaded) throw new SectShopError(404, '宗门宝库商品不存在');
  assertPurchasable(loaded.row, loaded.item);
  const purchasedCount = await countPurchases(
    params.cultivatorId,
    loaded.row.id,
    params.purchaseWeek,
    params.tx,
  );
  if (
    typeof loaded.row.perUserLimit === 'number' &&
    purchasedCount >= loaded.row.perUserLimit
  ) {
    throw new SectShopError(400, '此物已达兑换上限');
  }

  const attachment = newRewardAttachment(
    buildAttachmentFromItemLibraryEntry(
      parseItem(loaded.item),
      loaded.row.quantity,
    ),
  );
  if (attachment.type !== 'inventory_v1' || !attachment.inventory)
    throw new SectShopError(400, '此商品尚未开放新版兑换');
  await assertInventoryIdle(params.cultivatorId);
  await params.spendContribution(loaded.row.price);
  const delivered = await grantInventory(
    params.cultivatorId,
    [attachment.inventory],
    params.tx,
  );

  await params.tx.insert(sectShopPurchases).values({
    shopItemId: loaded.row.id,
    cultivatorId: params.cultivatorId,
    membershipId: params.membershipId,
    itemLibraryItemId: loaded.row.itemLibraryItemId,
    quantity: loaded.row.quantity,
    contributionCost: loaded.row.price,
    purchaseWeek: params.purchaseWeek,
  });

  return {
    item: await buildView({
      row: loaded.row,
      item: loaded.item,
      cultivatorId: params.cultivatorId,
      purchaseWeek: params.purchaseWeek,
      q: params.tx,
    }),
    destinations: [...new Set(delivered.map((item) => item.location))],
  };
}
