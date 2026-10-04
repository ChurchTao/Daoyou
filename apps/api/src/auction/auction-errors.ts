import { redisLockErrorResponse } from '@server/lib/http/errors.js';
import { AuctionServiceError } from '@server/auction/application/AuctionService.js';
import { BeastError } from '@server/combat/application/BeastMutationGuard.js';
import { PlayerCommandIdempotencyError } from '@server/player/application/state/CommandExecutors.js';
import { InventoryError } from '@server/inventory/operations.js';
import { z } from 'zod';
import { apiErrorFilter } from '../http/error-filter.js';

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

export const AuctionListingsErrors = apiErrorFilter((error) => {
  if (error instanceof z.ZodError)
    return Response.json(
      { error: '参数错误', details: error.issues },
      { status: 400 },
    );
  console.error('Auction Listings API Error:', error);
  return Response.json({ error: '获取拍卖列表失败' }, { status: 500 });
});

export function auctionMutationErrors(
  operation: 'buy' | 'list' | 'list-beast' | 'cancel',
) {
  return apiErrorFilter((error) => {
    const lock = redisLockErrorResponse(error);
    if (lock) return lock;
    if (operation === 'buy' && error instanceof z.ZodError)
      return Response.json(
        { error: '参数错误', details: error.issues },
        { status: 400 },
      );
    if (
      error instanceof InventoryError ||
      error instanceof PlayerCommandIdempotencyError ||
      (operation === 'list-beast' && error instanceof BeastError)
    )
      return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof AuctionServiceError)
      return Response.json(
        { error: error.message },
        { status: statusMap[error.code] || 400 },
      );
    const action =
      operation === 'buy' ? 'Buy' : operation === 'cancel' ? 'Cancel' : 'List';
    console.error(`Auction ${action} API Error:`, error);
    const message =
      operation === 'buy'
        ? '购买失败，请稍后重试'
        : operation === 'cancel'
          ? '下架失败，请稍后重试'
          : '上架失败，请稍后重试';
    return Response.json({ error: message }, { status: 500 });
  });
}
