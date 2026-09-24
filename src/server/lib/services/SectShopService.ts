import {
  getExecutor,
  runDbTasks,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import { sectShopItems, sectShopPurchases } from '@server/lib/drizzle/schema';
import {
  RewardItemSchema,
  materializeRewardItem,
  rewardDisplayItem,
} from '@shared/contracts/adminRewards';
import type {
  SectShopItemData,
  SectShopItemMutation,
  SectShopItemStatus,
} from '@shared/contracts/sectShop';
import { SECT_SHOP_MAX_PRICE } from '@shared/contracts/sectShop';
import { getItemExchangePurchaseWeek } from '@shared/lib/itemExchangeShop';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { assertInventoryIdle, grantInventory } from './InventoryService';

type ShopItemRow = typeof sectShopItems.$inferSelect;

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
    item: args.row.itemSnapshot
      ? rewardDisplayItem(
          RewardItemSchema.parse({
            ...args.row.itemSnapshot,
            quantity: args.row.quantity,
          }),
        )
      : null,
    createdAt: toIso(args.row.createdAt),
    updatedAt: toIso(args.row.updatedAt),
  };
}

async function loadShopItem(
  id: string,
  q: DbExecutor | DbTransaction,
): Promise<{ row: ShopItemRow } | null> {
  const [row] = await q
    .select()
    .from(sectShopItems)
    .where(eq(sectShopItems.id, id))
    .limit(1);
  return row ? { row } : null;
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
  }
  const query = q
    .select({ row: sectShopItems })
    .from(sectShopItems)
    .orderBy(asc(sectShopItems.sortOrder), desc(sectShopItems.updatedAt));
  const rows =
    whereConditions.length > 0
      ? await query.where(and(...whereConditions))
      : await query;
  return runDbTasks(
    q,
    rows
      .filter(
        (entry) => !args.userVisibleOnly || entry.row.itemSnapshot !== null,
      )
      .map(
        (entry) => () =>
          buildView({
            row: entry.row,
            cultivatorId: args.cultivatorId,
            purchaseWeek: args.purchaseWeek,
            q,
          }),
      ),
  );
}

function assertPurchasable(row: ShopItemRow): void {
  if (row.status !== 'active' || !row.itemSnapshot) {
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
  RewardItemSchema.parse({ ...row.itemSnapshot, quantity: row.quantity });
}

export async function createSectShopItem(params: {
  input: SectShopItemMutation;
  userId: string;
}): Promise<SectShopItemData> {
  const { item, ...input } = params.input;
  const { quantity, ...itemSnapshot } = RewardItemSchema.parse(item);
  const q = getExecutor();
  const [row] = await q
    .insert(sectShopItems)
    .values({
      ...input,
      quantity,
      itemSnapshot,
      perUserLimit: params.input.perUserLimit ?? null,
      createdBy: params.userId,
      updatedBy: params.userId,
    })
    .returning();
  const loaded = await loadShopItem(row.id, q);
  if (!loaded) throw new Error('宗门宝库商品创建后读取失败');
  return buildView({ ...loaded, q });
}

export async function updateSectShopItem(params: {
  id: string;
  input: SectShopItemMutation;
  userId: string;
}): Promise<SectShopItemData | null> {
  const { item, ...input } = params.input;
  const { quantity, ...itemSnapshot } = RewardItemSchema.parse(item);
  const q = getExecutor();
  const [row] = await q
    .update(sectShopItems)
    .set({
      ...input,
      quantity,
      itemSnapshot,
      perUserLimit: params.input.perUserLimit ?? null,
      updatedBy: params.userId,
      updatedAt: new Date(),
    })
    .where(eq(sectShopItems.id, params.id))
    .returning();
  if (!row) return null;
  const loaded = await loadShopItem(row.id, q);
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
  const loaded = await loadShopItem(row.id, q);
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
  const loaded = await loadShopItem(params.id, params.tx);
  if (!loaded) throw new SectShopError(404, '宗门宝库商品不存在');
  assertPurchasable(loaded.row);
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

  const grant = materializeRewardItem(
    RewardItemSchema.parse({
      ...loaded.row.itemSnapshot,
      quantity: loaded.row.quantity,
    }),
    randomUUID,
  );
  await assertInventoryIdle(params.cultivatorId);
  await params.spendContribution(loaded.row.price);
  const delivered = await grantInventory(
    params.cultivatorId,
    [grant],
    params.tx,
  );

  await params.tx.insert(sectShopPurchases).values({
    shopItemId: loaded.row.id,
    cultivatorId: params.cultivatorId,
    membershipId: params.membershipId,
    itemLibraryItemId: null, // Legacy-only audit field; current rewards use the shop snapshot.
    quantity: loaded.row.quantity,
    contributionCost: loaded.row.price,
    purchaseWeek: params.purchaseWeek,
  });

  return {
    item: await buildView({
      row: loaded.row,
      cultivatorId: params.cultivatorId,
      purchaseWeek: params.purchaseWeek,
      q: params.tx,
    }),
    destinations: [...new Set(delivered.map((item) => item.location))],
  };
}
