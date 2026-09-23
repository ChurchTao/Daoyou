import {
  getExecutor,
  runDbTasks,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import {
  reputationShopItems,
  reputationShopPurchases,
} from '@server/lib/drizzle/schema';
import { resourceEngine } from '@server/lib/services/resource/ResourceEngine';
import {
  RewardItemSchema,
  materializeRewardItem,
  rewardDisplayItem,
} from '@shared/contracts/adminRewards';
import {
  REPUTATION_SHOP_MAX_PRICE,
  type ReputationShopItemMutation,
  type ReputationShopItemStatus,
  type ReputationShopItemView,
} from '@shared/contracts/reputationShop';
import { getItemExchangePurchaseWeek } from '@shared/lib/itemExchangeShop';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { grantInventory } from './InventoryService';

type ShopItemRow = typeof reputationShopItems.$inferSelect;

export class ReputationShopError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

export function getReputationShopPurchaseWeek(date = new Date()): string {
  return getItemExchangePurchaseWeek(date);
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
    .from(reputationShopItems)
    .where(eq(reputationShopItems.id, id))
    .limit(1);
  return row ? { row } : null;
}

export async function listReputationShopItems(
  args: {
    cultivatorId?: string;
    status?: ReputationShopItemStatus;
    userVisibleOnly?: boolean;
    q?: DbExecutor | DbTransaction;
  } = {},
): Promise<ReputationShopItemView[]> {
  const q = args.q ?? getExecutor();
  const whereConditions: SQL<unknown>[] = [];
  if (args.status) {
    whereConditions.push(eq(reputationShopItems.status, args.status));
  }
  if (args.userVisibleOnly) {
    whereConditions.push(eq(reputationShopItems.status, 'active'));
  }

  const query = q
    .select({ row: reputationShopItems })
    .from(reputationShopItems)
    .orderBy(
      asc(reputationShopItems.sortOrder),
      desc(reputationShopItems.updatedAt),
    );

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
            q,
          }),
      ),
  );
}

function assertStoredShopItem(row: ShopItemRow): void {
  if (row.status !== 'active' || !row.itemSnapshot) {
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
  RewardItemSchema.parse({ ...row.itemSnapshot, quantity: row.quantity });
}

export async function createReputationShopItem(params: {
  input: ReputationShopItemMutation;
  userId: string;
}): Promise<ReputationShopItemView> {
  const { quantity, ...itemSnapshot } = RewardItemSchema.parse(
    params.input.item,
  );
  const q = getExecutor();
  const [row] = await q
    .insert(reputationShopItems)
    .values({
      itemSnapshot,
      price: params.input.price,
      quantity,
      perUserLimit: params.input.perUserLimit ?? null,
      status: params.input.status,
      sortOrder: params.input.sortOrder,
      createdBy: params.userId,
      updatedBy: params.userId,
    })
    .returning();

  const loaded = await loadShopItem(row.id, q);
  if (!loaded) throw new Error('声望商店商品创建后读取失败');
  return buildView({ ...loaded, q });
}

export async function updateReputationShopItem(params: {
  id: string;
  input: ReputationShopItemMutation;
  userId: string;
}): Promise<ReputationShopItemView | null> {
  const { quantity, ...itemSnapshot } = RewardItemSchema.parse(
    params.input.item,
  );
  const q = getExecutor();
  const [row] = await q
    .update(reputationShopItems)
    .set({
      itemSnapshot,
      price: params.input.price,
      quantity,
      perUserLimit: params.input.perUserLimit ?? null,
      status: params.input.status,
      sortOrder: params.input.sortOrder,
      updatedBy: params.userId,
      updatedAt: new Date(),
    })
    .where(eq(reputationShopItems.id, params.id))
    .returning();

  if (!row) return null;
  const loaded = await loadShopItem(row.id, q);
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
  const loaded = await loadShopItem(row.id, q);
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
  destinations: Array<'bag' | 'storage'>;
}> {
  const loaded = await loadShopItem(params.id, params.tx);
  if (!loaded) {
    throw new ReputationShopError(404, '天骄宝阁商品不存在');
  }
  assertStoredShopItem(loaded.row);

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

  const grant = materializeRewardItem(
    RewardItemSchema.parse({
      ...loaded.row.itemSnapshot,
      quantity: loaded.row.quantity,
    }),
    randomUUID,
  );
  const resourceResult = await resourceEngine.applyInTransaction({
    userId: params.userId,
    cultivatorId: params.cultivatorId,
    consume: [{ type: 'reputation', value: loaded.row.price }],
    tx: params.tx,
  });
  if (!resourceResult.success) {
    throw new ReputationShopError(
      400,
      resourceResult.errors?.[0] ?? '兑换结算失败',
    );
  }
  if (!resourceResult.settlement) {
    throw new ReputationShopError(500, '兑换结算结果缺失');
  }

  const delivered = await grantInventory(
    params.cultivatorId,
    [grant],
    params.tx,
  );

  await params.tx.insert(reputationShopPurchases).values({
    shopItemId: loaded.row.id,
    cultivatorId: params.cultivatorId,
    itemLibraryItemId: null, // Legacy-only audit field; current rewards use the shop snapshot.
    quantity: loaded.row.quantity,
    reputationCost: loaded.row.price,
    purchaseWeek,
  });

  return {
    item: await buildView({
      row: loaded.row,
      cultivatorId: params.cultivatorId,
      q: params.tx,
    }),
    reputation: resourceResult.settlement.reputation ?? 0,
    destinations: [...new Set(delivered.map((item) => item.location))],
  };
}
