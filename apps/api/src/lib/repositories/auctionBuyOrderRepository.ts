import type { AuctionBuyOrderItemType } from '@daoyou/game-domain/auction';
import {
  and,
  asc,
  desc,
  eq,
  gte,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '../drizzle/db.js';
import * as schema from '../drizzle/schema.js';

export type AuctionBuyOrder = typeof schema.auctionBuyOrders.$inferSelect;

export async function createBuyOrder(
  data: {
    buyerId: string;
    buyerName: string;
    targetMode: 'exact' | 'condition';
    itemType: AuctionBuyOrderItemType;
    itemName: string;
    itemQuality: string;
    itemCategory: string;
    targetDefinitionId: string;
    targetStackKey: string | null;
    targetSnapshot: unknown | null;
    targetConditions: unknown | null;
    price: number;
    quantity: number;
    expiresAt: Date;
  },
  tx?: DbTransaction,
): Promise<AuctionBuyOrder> {
  const q = getExecutor(tx);
  const [order] = await q
    .insert(schema.auctionBuyOrders)
    .values({
      buyerId: data.buyerId,
      buyerName: data.buyerName,
      targetMode: data.targetMode,
      itemType: data.itemType,
      itemName: data.itemName,
      itemQuality: data.itemQuality,
      itemCategory: data.itemCategory,
      targetDefinitionId: data.targetDefinitionId,
      targetStackKey: data.targetStackKey,
      targetSnapshot: data.targetSnapshot,
      targetConditions: data.targetConditions,
      price: data.price,
      initialQuantity: data.quantity,
      remainingQuantity: data.quantity,
      status: 'active',
      expiresAt: data.expiresAt,
    })
    .returning();
  return order;
}

export async function findById(
  id: string,
  executor?: DbExecutor,
): Promise<AuctionBuyOrder | null> {
  const q = executor ?? getExecutor();
  const [order] = await q
    .select()
    .from(schema.auctionBuyOrders)
    .where(eq(schema.auctionBuyOrders.id, id))
    .limit(1);
  return order ?? null;
}

export interface FindActiveBuyOrdersOptions {
  scope?: 'all' | 'mine';
  itemType?: AuctionBuyOrderItemType;
  itemCategory?: string;
  itemQuality?: string;
  itemName?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price_desc' | 'latest';
  page?: number;
  limit?: number;
  viewerCultivatorId?: string;
}

export async function findActiveBuyOrders(
  options: FindActiveBuyOrdersOptions = {},
  executor?: DbExecutor,
): Promise<{ orders: AuctionBuyOrder[]; total: number }> {
  const q = executor ?? getExecutor();
  const {
    scope = 'all',
    itemType,
    itemCategory,
    itemQuality,
    itemName,
    minPrice,
    maxPrice,
    sortBy = 'price_desc',
    page = 1,
    limit = 20,
    viewerCultivatorId,
  } = options;

  const conditions: SQL<unknown>[] = [
    eq(schema.auctionBuyOrders.status, 'active'),
    gte(schema.auctionBuyOrders.expiresAt, new Date()),
  ];
  if (scope === 'mine') {
    conditions.push(
      viewerCultivatorId
        ? eq(schema.auctionBuyOrders.buyerId, viewerCultivatorId)
        : sql`false`,
    );
  }
  if (itemType)
    conditions.push(eq(schema.auctionBuyOrders.itemType, itemType));
  if (itemCategory) {
    const category = or(
      eq(schema.auctionBuyOrders.itemCategory, itemCategory),
      and(
        eq(schema.auctionBuyOrders.itemType, 'material'),
        eq(schema.auctionBuyOrders.itemCategory, 'material'),
      ),
    );
    if (category) conditions.push(category);
  }
  if (itemQuality)
    conditions.push(eq(schema.auctionBuyOrders.itemQuality, itemQuality));
  if (itemName)
    conditions.push(eq(schema.auctionBuyOrders.itemName, itemName));
  if (minPrice !== undefined)
    conditions.push(gte(schema.auctionBuyOrders.price, minPrice));
  if (maxPrice !== undefined)
    conditions.push(lte(schema.auctionBuyOrders.price, maxPrice));

  const whereClause = and(...conditions);
  const orderByClause =
    sortBy === 'latest'
      ? desc(schema.auctionBuyOrders.createdAt)
      : desc(schema.auctionBuyOrders.price);

  const orders = await q
    .select()
    .from(schema.auctionBuyOrders)
    .where(whereClause)
    .orderBy(orderByClause, asc(schema.auctionBuyOrders.id))
    .limit(limit)
    .offset((page - 1) * limit);
  const countResult = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.auctionBuyOrders)
    .where(whereClause);

  return { orders, total: countResult[0]?.count || 0 };
}

export async function countActiveByBuyer(
  buyerId: string,
  executor?: DbExecutor,
): Promise<number> {
  const q = executor ?? getExecutor();
  const [row] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.auctionBuyOrders)
    .where(
      and(
        eq(schema.auctionBuyOrders.buyerId, buyerId),
        eq(schema.auctionBuyOrders.status, 'active'),
        gte(schema.auctionBuyOrders.expiresAt, new Date()),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function consumeBuyOrderQuantity(
  tx: DbTransaction,
  id: string,
  quantity: number,
): Promise<AuctionBuyOrder | null> {
  const [order] = await tx
    .update(schema.auctionBuyOrders)
    .set({
      remainingQuantity: sql`${schema.auctionBuyOrders.remainingQuantity} - ${quantity}`,
      status: sql`case when ${schema.auctionBuyOrders.remainingQuantity} = ${quantity} then 'filled' else 'active' end`,
      filledAt: sql`case when ${schema.auctionBuyOrders.remainingQuantity} = ${quantity} then now() else null end`,
    })
    .where(
      and(
        eq(schema.auctionBuyOrders.id, id),
        eq(schema.auctionBuyOrders.status, 'active'),
        gte(schema.auctionBuyOrders.expiresAt, new Date()),
        gte(schema.auctionBuyOrders.remainingQuantity, quantity),
      ),
    )
    .returning();
  return order ?? null;
}

export async function transitionStatus(
  tx: DbTransaction,
  id: string,
  from: 'active',
  to: 'filled' | 'expired' | 'cancelled',
  options: { buyerId?: string } = {},
): Promise<AuctionBuyOrder | null> {
  const conditions = [
    eq(schema.auctionBuyOrders.id, id),
    eq(schema.auctionBuyOrders.status, from),
  ];
  if (options.buyerId)
    conditions.push(eq(schema.auctionBuyOrders.buyerId, options.buyerId));

  const [order] = await tx
    .update(schema.auctionBuyOrders)
    .set({ status: to })
    .where(and(...conditions))
    .returning();
  return order ?? null;
}

export async function markExpiredBuyOrders(
  tx: DbTransaction,
): Promise<AuctionBuyOrder[]> {
  return tx
    .update(schema.auctionBuyOrders)
    .set({ status: 'expired' })
    .where(
      and(
        eq(schema.auctionBuyOrders.status, 'active'),
        sql`${schema.auctionBuyOrders.expiresAt} < NOW()`,
      ),
    )
    .returning();
}
