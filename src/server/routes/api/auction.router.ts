import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import * as auctionRepository from '@server/lib/repositories/auctionRepository';
import {
  buyAuctionListing,
  cancelAuctionListing,
  listAuctionItem,
} from '@server/lib/services/AuctionApplicationService';
import {
  AuctionServiceError,
  publicAuctionListing,
} from '@server/lib/services/AuctionService';
import { PlayerCommandIdempotencyError } from '@server/lib/services/CommandExecutors';
import { InventoryError } from '@server/lib/services/InventoryService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import {
  AUCTION_ITEM_TYPES,
  AuctionBuySchema,
  AuctionListSchema,
} from '@shared/contracts/auction';
import { QUALITY_VALUES } from '@shared/types/constants';
import { Hono } from 'hono';
import { z } from 'zod';

const ListingsSchema = z.object({
  scope: z.enum(['all', 'mine']).default('all'),
  itemType: z.enum(AUCTION_ITEM_TYPES).optional(),
  itemCategory: z.string().trim().min(1).max(50).optional(),
  itemQuality: z.enum(QUALITY_VALUES).optional(),
  itemName: z.string().trim().min(1).max(200).optional(),
  sellerName: z.string().trim().min(1).max(100).optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'latest']).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const statusMap: Record<string, number> = {
  INSUFFICIENT_FUNDS: 400,
  LISTING_NOT_FOUND: 404,
  LISTING_EXPIRED: 400,
  NOT_OWNER: 403,
  MAX_LISTINGS: 400,
  ITEM_NOT_FOUND: 404,
  CONCURRENT_PURCHASE: 429,
  INVALID_ITEM_TYPE: 400,
  INVALID_PRICE: 400,
  INVALID_QUANTITY: 400,
  INVALID_ITEM_QUALITY: 400,
  SAME_OWNER: 403,
  INVALID_VISIBILITY: 400,
  TARGET_NOT_FRIEND: 403,
  MISSING_TALISMAN: 400,
  NOT_TARGET_BUYER: 403,
};

function getAuctionErrorStatus(error: AuctionServiceError): number {
  return statusMap[error.code] || 400;
}

const router = new Hono<AppEnv>();

router.get('/listings', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const params = ListingsSchema.parse({
      scope: c.req.query('scope') || undefined,
      itemType: c.req.query('itemType') || undefined,
      itemCategory: c.req.query('itemCategory') || undefined,
      itemQuality: c.req.query('itemQuality') || undefined,
      itemName: c.req.query('itemName') || undefined,
      sellerName: c.req.query('sellerName') || undefined,
      minPrice: c.req.query('minPrice')
        ? Number(c.req.query('minPrice'))
        : undefined,
      maxPrice: c.req.query('maxPrice')
        ? Number(c.req.query('maxPrice'))
        : undefined,
      sortBy: c.req.query('sortBy') || undefined,
      page: c.req.query('page') ? Number(c.req.query('page')) : undefined,
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
    });

    const result = await auctionRepository.findActiveListings({
      ...params,
      viewerCultivatorId: cultivator.cultivatorId,
    });
    const page = params.page || 1;
    const limit = params.limit || 20;
    const totalPages = Math.ceil(result.total / limit);

    return c.json({
      listings: result.listings.map(publicAuctionListing),
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }

    console.error('Auction Listings API Error:', error);
    return c.json({ error: '获取拍卖列表失败' }, 500);
  }
});

router.post('/buy', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { listingId, quantity, requestId } = AuctionBuySchema.parse(
      await c.req.json(),
    );

    const committed = await buyAuctionListing({
      actor: {
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
      },
      listingId,
      quantity,
      requestId,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }

    if (
      error instanceof InventoryError ||
      error instanceof PlayerCommandIdempotencyError
    )
      return c.json({ error: error.message }, 409);
    if (error instanceof AuctionServiceError) {
      return jsonWithStatus(
        c,
        { error: error.message },
        getAuctionErrorStatus(error),
      );
    }

    console.error('Auction Buy API Error:', error);
    return c.json({ error: '购买失败，请稍后重试' }, 500);
  }
});

router.post('/list', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const request = AuctionListSchema.safeParse(
    await c.req.json().catch(() => undefined),
  );
  if (!request.success) {
    return c.json({ error: '参数错误', details: request.error.issues }, 400);
  }

  try {
    const {
      requestId,
      revision,
      itemId,
      price,
      quantity,
      visibility,
      targetCultivatorId,
    } = request.data;

    const committed = await listAuctionItem({
      actor: {
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
      },
      requestId,
      revision,
      itemId,
      price,
      quantity,
      visibility,
      targetCultivatorId,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (
      error instanceof InventoryError ||
      error instanceof PlayerCommandIdempotencyError
    )
      return c.json({ error: error.message }, 409);
    if (error instanceof AuctionServiceError) {
      return jsonWithStatus(
        c,
        { error: error.message },
        getAuctionErrorStatus(error),
      );
    }

    console.error('Auction List API Error:', error);
    return c.json({ error: '上架失败，请稍后重试' }, 500);
  }
});

router.delete('/:id', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const parsedId = z.uuid().safeParse(c.req.param('id'));
    if (!parsedId.success) return c.json({ error: '货单标识无效' }, 400);
    const listingId = parsedId.data;
    const committed = await cancelAuctionListing({
      actor: {
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
      },
      listingId,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (
      error instanceof InventoryError ||
      error instanceof PlayerCommandIdempotencyError
    )
      return c.json({ error: error.message }, 409);
    if (error instanceof AuctionServiceError) {
      return jsonWithStatus(
        c,
        { error: error.message },
        getAuctionErrorStatus(error),
      );
    }

    console.error('Auction Cancel API Error:', error);
    return c.json({ error: '下架失败，请稍后重试' }, 500);
  }
});

export default router;
