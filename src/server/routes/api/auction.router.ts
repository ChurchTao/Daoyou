import * as auctionRepository from '@server/lib/repositories/auctionRepository';
import {
  requireActiveCultivator,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  commitPlayerStateMutation,
  type StateChangeDescriptor,
  toPlayerStateMutationResponse,
} from '@server/lib/services/PlayerStateMutationService';
import {
  AuctionServiceError,
  buyItem,
  cancelListing,
  clearAuctionListingsCache,
  listItem,
} from '@server/lib/services/AuctionService';
import { Hono } from 'hono';
import { z } from 'zod';

const ListingsSchema = z.object({
  itemType: z.enum(['material', 'artifact', 'consumable']).optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'latest']).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const BuySchema = z.object({
  listingId: z.string().uuid(),
});

const ListSchema = z.object({
  itemType: z.enum(['material', 'artifact', 'consumable']),
  itemId: z.string().uuid(),
  price: z.number().int().min(1).max(9_999_999),
  quantity: z.number().int().min(1).default(1),
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
  CONSUMABLE_LISTING_DISABLED: 400,
  SAME_OWNER: 403,
};

function getAuctionErrorStatus(error: AuctionServiceError): number {
  return statusMap[error.code] || 400;
}

const router = new Hono<AppEnv>();

router.get('/listings', async (c) => {
  try {
    const params = ListingsSchema.parse({
      itemType: c.req.query('itemType') || undefined,
      minPrice: c.req.query('minPrice') ? Number(c.req.query('minPrice')) : undefined,
      maxPrice: c.req.query('maxPrice') ? Number(c.req.query('maxPrice')) : undefined,
      sortBy: c.req.query('sortBy') || undefined,
      page: c.req.query('page') ? Number(c.req.query('page')) : undefined,
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
    });

    const result = await auctionRepository.findActiveListings(params);
    const page = params.page || 1;
    const limit = params.limit || 20;
    const totalPages = Math.ceil(result.total / limit);

    return c.json({
      listings: result.listings,
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

router.post('/buy', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { listingId } = BuySchema.parse(await c.req.json());

    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'auction_buy',
      run: async (tx) => {
        await buyItem(
          {
            listingId,
            buyerCultivatorId: cultivator.id,
            buyerCultivatorName: cultivator.name,
          },
          { tx, deferCacheClear: true },
        );

        return {
          result: {
            message: '成功购入物品，请查收邮件',
          },
          changes: [
            {
              domain: 'currency',
              eventType: 'currency.auction.spent',
              invalidates: ['currency'],
            },
            {
              domain: 'mail',
              eventType: 'mail.auction.purchase.created',
              invalidates: ['mail'],
            },
          ],
        };
      },
    });

    await clearAuctionListingsCache();
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }

    if (error instanceof AuctionServiceError) {
      return jsonWithStatus(c, { error: error.message }, getAuctionErrorStatus(error));
    }

    console.error('Auction Buy API Error:', error);
    return c.json({ error: '购买失败，请稍后重试' }, 500);
  }
});

router.post('/list', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const { itemType, itemId, price, quantity } = ListSchema.parse(
      await c.req.json(),
    );

    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'auction_list',
      run: async (tx) => {
        const result = await listItem(
          {
            cultivatorId: cultivator.id,
            cultivatorName: cultivator.name,
            itemType,
            itemId,
            price,
            quantity,
          },
          { tx, deferCacheClear: true },
        );

        const changes: StateChangeDescriptor[] = [
          {
            domain: 'inventory',
            eventType: 'inventory.auction.listed',
            invalidates: ['inventory'],
          },
        ];
        if (itemType === 'artifact') {
          changes.push({
            domain: 'products',
            eventType: 'products.auction.listed',
            invalidates: ['products'],
          });
        }

        return {
          result,
          changes,
        };
      },
    });

    await clearAuctionListingsCache();
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }

    if (error instanceof AuctionServiceError) {
      return jsonWithStatus(c, { error: error.message }, getAuctionErrorStatus(error));
    }

    console.error('Auction List API Error:', error);
    return c.json({ error: '上架失败，请稍后重试' }, 500);
  }
});

router.delete('/:id', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'auction_cancel',
      run: async (tx) => {
        await cancelListing(c.req.param('id'), cultivator.id, {
          tx,
          deferCacheClear: true,
        });
        return {
          result: {
            message: '物品已下架，将通过邮件返还',
          },
          changes: [
            {
              domain: 'mail',
              eventType: 'mail.auction.cancel.created',
              invalidates: ['mail'],
            },
          ],
        };
      },
    });
    await clearAuctionListingsCache();
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    if (error instanceof AuctionServiceError) {
      return jsonWithStatus(c, { error: error.message }, getAuctionErrorStatus(error));
    }

    console.error('Auction Cancel API Error:', error);
    return c.json({ error: '下架失败，请稍后重试' }, 500);
  }
});

export default router;
