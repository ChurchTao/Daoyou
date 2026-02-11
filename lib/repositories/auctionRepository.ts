import { and, asc, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { db, type DbTransaction } from '../drizzle/db';
import * as schema from '../drizzle/schema';

/**
 * 拍卖列表项（从数据库读取）
 */
export type AuctionListing = typeof schema.auctionListings.$inferSelect;

/**
 * 创建拍卖记录
 */
export async function createListing(data: {
  sellerId: string;
  sellerName: string;
  itemType: 'material' | 'artifact' | 'consumable';
  itemId: string;
  itemSnapshot: unknown;
  price: number;
  expiresAt: Date;
}): Promise<AuctionListing> {
  const [listing] = await db()
    .insert(schema.auctionListings)
    .values({
      sellerId: data.sellerId,
      sellerName: data.sellerName,
      itemType: data.itemType,
      itemId: data.itemId,
      itemSnapshot: data.itemSnapshot,
      price: data.price,
      status: 'active',
      expiresAt: data.expiresAt,
    })
    .returning();
  return listing;
}

/**
 * 查询单个拍卖记录
 */
export async function findById(id: string): Promise<AuctionListing | null> {
  const [listing] = await db()
    .select()
    .from(schema.auctionListings)
    .where(eq(schema.auctionListings.id, id))
    .limit(1);
  return listing || null;
}

/**
 * 查询进行中的拍卖列表（支持筛选、分页、排序）
 */
export interface FindActiveListingsOptions {
  itemType?: 'material' | 'artifact' | 'consumable';
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'latest';
  page?: number;
  limit?: number;
}

export async function findActiveListings(
  options: FindActiveListingsOptions = {},
): Promise<{ listings: AuctionListing[]; total: number }> {
  const {
    itemType,
    minPrice,
    maxPrice,
    sortBy = 'latest',
    page = 1,
    limit = 20,
  } = options;

  // 构建筛选条件
  const conditions: SQL<unknown>[] = [
    eq(schema.auctionListings.status, 'active'),
    gte(schema.auctionListings.expiresAt, new Date()),
  ];

  if (itemType) {
    conditions.push(eq(schema.auctionListings.itemType, itemType));
  }
  if (minPrice !== undefined) {
    conditions.push(gte(schema.auctionListings.price, minPrice));
  }
  if (maxPrice !== undefined) {
    conditions.push(lte(schema.auctionListings.price, maxPrice));
  }

  const whereClause = and(...conditions);

  // 构建排序
  let orderByClause;
  switch (sortBy) {
    case 'price_asc':
      orderByClause = asc(schema.auctionListings.price);
      break;
    case 'price_desc':
      orderByClause = desc(schema.auctionListings.price);
      break;
    case 'latest':
    default:
      orderByClause = desc(schema.auctionListings.createdAt);
      break;
  }

  // 并行执行查询和计数
  const [listingsResult, countResult] = await Promise.all([
    db()
      .select()
      .from(schema.auctionListings)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset((page - 1) * limit),
    db()
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.auctionListings)
      .where(whereClause),
  ]);

  return {
    listings: listingsResult,
    total: countResult[0]?.count || 0,
  };
}

/**
 * 统计卖家进行中的拍卖数量
 */
export async function countActiveBySeller(sellerId: string): Promise<number> {
  const result = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.auctionListings)
    .where(
      and(
        eq(schema.auctionListings.sellerId, sellerId),
        eq(schema.auctionListings.status, 'active'),
      ),
    );
  return result[0]?.count || 0;
}

/**
 * 更新拍卖状态（在事务中使用）
 */
export async function updateStatus(
  tx: DbTransaction,
  id: string,
  status: 'sold' | 'expired' | 'cancelled',
  soldAt?: Date,
): Promise<void> {
  await tx
    .update(schema.auctionListings)
    .set({
      status,
      ...(soldAt && { soldAt }),
    })
    .where(eq(schema.auctionListings.id, id));
}

/**
 * 查询过期但状态仍为 active 的拍卖记录
 */
export async function findExpiredListings(
  limit = 1000,
): Promise<AuctionListing[]> {
  return db()
    .select()
    .from(schema.auctionListings)
    .where(
      and(
        eq(schema.auctionListings.status, 'active'),
        sql`${schema.auctionListings.expiresAt} < NOW()`,
      ),
    )
    .limit(limit);
}

/**
 * 批量更新过期拍卖状态（在事务中使用）
 */
export async function batchUpdateExpiredStatus(
  tx: DbTransaction,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  await tx
    .update(schema.auctionListings)
    .set({ status: 'expired' })
    .where(sql`id = ANY(${ids})`);
}
