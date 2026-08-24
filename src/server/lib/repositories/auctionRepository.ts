import { and, asc, desc, eq, gte, lte, or, sql, type SQL } from 'drizzle-orm';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '../drizzle/db';
import * as schema from '../drizzle/schema';

/**
 * 拍卖列表项（从数据库读取）
 */
export type AuctionListing = typeof schema.auctionListings.$inferSelect;

export interface CreateAuctionListingData {
  sellerId: string;
  sellerName: string;
  itemType: 'material' | 'artifact' | 'consumable';
  itemId: string;
  itemName: string;
  itemQuality: string;
  itemCategory: string;
  itemSnapshot: unknown;
  price: number;
  initialQuantity: number;
  remainingQuantity: number;
  visibility?: 'public' | 'private';
  targetCultivatorId?: string;
  targetCultivatorName?: string;
  expiresAt: Date;
}

/**
 * 创建拍卖记录
 */
export async function createListing(
  data: CreateAuctionListingData & { tx?: DbTransaction },
): Promise<AuctionListing> {
  const q = getExecutor(data.tx);
  const [listing] = await q
    .insert(schema.auctionListings)
    .values({
      sellerId: data.sellerId,
      sellerName: data.sellerName,
      itemType: data.itemType,
      itemId: data.itemId,
      itemName: data.itemName,
      itemQuality: data.itemQuality,
      itemCategory: data.itemCategory,
      itemSnapshot: data.itemSnapshot,
      price: data.price,
      initialQuantity: data.initialQuantity,
      remainingQuantity: data.remainingQuantity,
      visibility: data.visibility ?? 'public',
      targetCultivatorId: data.targetCultivatorId,
      targetCultivatorName: data.targetCultivatorName,
      status: 'active',
      expiresAt: data.expiresAt,
    })
    .returning();
  return listing;
}

export async function createListings(
  tx: DbTransaction,
  listings: CreateAuctionListingData[],
): Promise<AuctionListing[]> {
  if (listings.length === 0) return [];
  return tx
    .insert(schema.auctionListings)
    .values(
      listings.map((data) => ({
        sellerId: data.sellerId,
        sellerName: data.sellerName,
        itemType: data.itemType,
        itemId: data.itemId,
        itemName: data.itemName,
        itemQuality: data.itemQuality,
        itemCategory: data.itemCategory,
        itemSnapshot: data.itemSnapshot,
        price: data.price,
        initialQuantity: data.initialQuantity,
        remainingQuantity: data.remainingQuantity,
        visibility: data.visibility ?? 'public',
        targetCultivatorId: data.targetCultivatorId,
        targetCultivatorName: data.targetCultivatorName,
        status: 'active',
        expiresAt: data.expiresAt,
      })),
    )
    .returning();
}

/**
 * 查询单个拍卖记录
 */
export async function findById(
  id: string,
  executor?: DbExecutor,
): Promise<AuctionListing | null> {
  const q = executor ?? getExecutor();
  const [listing] = await q
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
  scope?: 'all' | 'mine';
  itemType?: 'material' | 'artifact' | 'consumable';
  itemCategory?: string;
  itemQuality?: string;
  itemName?: string;
  sellerName?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price_asc' | 'price_desc' | 'latest';
  page?: number;
  limit?: number;
  viewerCultivatorId?: string;
}

export async function findActiveListings(
  options: FindActiveListingsOptions = {},
): Promise<{ listings: AuctionListing[]; total: number }> {
  const q = getExecutor();
  const {
    scope = 'all',
    itemType,
    itemCategory,
    itemQuality,
    itemName,
    sellerName,
    minPrice,
    maxPrice,
    sortBy = 'latest',
    page = 1,
    limit = 20,
    viewerCultivatorId,
  } = options;

  // 构建筛选条件
  const conditions: SQL<unknown>[] = [
    eq(schema.auctionListings.status, 'active'),
    gte(schema.auctionListings.expiresAt, new Date()),
  ];

  if (itemType) {
    conditions.push(eq(schema.auctionListings.itemType, itemType));
  }
  if (itemCategory) {
    conditions.push(eq(schema.auctionListings.itemCategory, itemCategory));
  }
  if (itemQuality) {
    conditions.push(eq(schema.auctionListings.itemQuality, itemQuality));
  }
  if (itemName) {
    conditions.push(eq(schema.auctionListings.itemName, itemName));
  }
  if (sellerName) {
    conditions.push(eq(schema.auctionListings.sellerName, sellerName));
  }
  if (minPrice !== undefined) {
    conditions.push(gte(schema.auctionListings.price, minPrice));
  }
  if (maxPrice !== undefined) {
    conditions.push(lte(schema.auctionListings.price, maxPrice));
  }
  if (scope === 'mine') {
    conditions.push(
      viewerCultivatorId
        ? eq(schema.auctionListings.sellerId, viewerCultivatorId)
        : sql`false`,
    );
  } else {
    conditions.push(
      viewerCultivatorId
        ? or(
            eq(schema.auctionListings.visibility, 'public'),
            eq(schema.auctionListings.sellerId, viewerCultivatorId),
            eq(schema.auctionListings.targetCultivatorId, viewerCultivatorId),
          )!
        : eq(schema.auctionListings.visibility, 'public'),
    );
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

  // 串行执行查询和计数，避免并发数据库查询
  const listingsResult = await q
    .select()
    .from(schema.auctionListings)
    .where(whereClause)
    .orderBy(orderByClause)
    .limit(limit)
    .offset((page - 1) * limit);
  const countResult = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.auctionListings)
    .where(whereClause);

  return {
    listings: listingsResult,
    total: countResult[0]?.count || 0,
  };
}

/**
 * 统计卖家进行中的拍卖数量
 */
export async function countActiveBySeller(
  sellerId: string,
  executor?: DbExecutor,
): Promise<number> {
  const q = executor ?? getExecutor();
  const result = await q
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

export async function countBySellerSince(
  sellerId: string,
  createdSince: Date,
  executor?: DbExecutor,
): Promise<number> {
  const q = executor ?? getExecutor();
  const result = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.auctionListings)
    .where(
      and(
        eq(schema.auctionListings.sellerId, sellerId),
        gte(schema.auctionListings.createdAt, createdSince),
      ),
    );
  return result[0]?.count || 0;
}

export async function expireActiveBySeller(
  tx: DbTransaction,
  sellerId: string,
): Promise<number> {
  const rows = await tx
    .update(schema.auctionListings)
    .set({ status: 'expired' })
    .where(
      and(
        eq(schema.auctionListings.sellerId, sellerId),
        eq(schema.auctionListings.status, 'active'),
      ),
    )
    .returning({ id: schema.auctionListings.id });
  return rows.length;
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

export async function transitionStatus(
  tx: DbTransaction,
  id: string,
  from: 'active',
  to: 'sold' | 'expired' | 'cancelled',
  options: { soldAt?: Date; sellerId?: string } = {},
): Promise<AuctionListing | null> {
  const conditions = [
    eq(schema.auctionListings.id, id),
    eq(schema.auctionListings.status, from),
  ];
  if (options.sellerId) {
    conditions.push(eq(schema.auctionListings.sellerId, options.sellerId));
  }

  const [listing] = await tx
    .update(schema.auctionListings)
    .set({
      status: to,
      ...(options.soldAt ? { soldAt: options.soldAt } : {}),
    })
    .where(and(...conditions))
    .returning();
  return listing ?? null;
}

export async function consumeListingQuantity(
  tx: DbTransaction,
  id: string,
  quantity: number,
): Promise<AuctionListing | null> {
  const [listing] = await tx
    .update(schema.auctionListings)
    .set({
      remainingQuantity: sql`${schema.auctionListings.remainingQuantity} - ${quantity}`,
      status: sql`case when ${schema.auctionListings.remainingQuantity} = ${quantity} then 'sold' else 'active' end`,
      soldAt: sql`case when ${schema.auctionListings.remainingQuantity} = ${quantity} then now() else null end`,
    })
    .where(
      and(
        eq(schema.auctionListings.id, id),
        eq(schema.auctionListings.status, 'active'),
        gte(schema.auctionListings.expiresAt, new Date()),
        gte(schema.auctionListings.remainingQuantity, quantity),
      ),
    )
    .returning();
  return listing ?? null;
}

/**
 * 查询过期但状态仍为 active 的拍卖记录
 */
export async function findExpiredListings(
  limit = 1000,
): Promise<AuctionListing[]> {
  const q = getExecutor();
  return q
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

/**
 * 原子标记过期拍卖并返回被更新的记录
 * 用于避免并发任务下重复处理/重复发邮件
 */
export async function markExpiredListings(
  tx: DbTransaction,
): Promise<AuctionListing[]> {
  return tx
    .update(schema.auctionListings)
    .set({ status: 'expired' })
    .where(
      and(
        eq(schema.auctionListings.status, 'active'),
        sql`${schema.auctionListings.expiresAt} < NOW()`,
      ),
    )
    .returning();
}
