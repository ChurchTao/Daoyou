import type { AuctionItemType } from '@daoyou/game-domain/auction';

import { z } from 'zod';


import { AUCTION_MAX_PURCHASE_QUANTITY, AUCTION_MAX_UNIT_PRICE } from '@daoyou/game-domain/auction';


















import { type BeastTradePreview } from '@daoyou/game-domain/beasts';




export const AuctionListSchema = z
  .object({
    requestId: z.uuid(),
    itemId: z.uuid(),
    revision: z.number().int().nonnegative(),
    price: z.number().int().min(1).max(AUCTION_MAX_UNIT_PRICE),
    quantity: z.number().int().min(1).max(2_147_483_647),
    visibility: z.enum(['public', 'private']).default('public'),
    targetCultivatorId: z.uuid().optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.visibility === 'private'
        ? !!v.targetCultivatorId
        : !v.targetCultivatorId,
    '专属寄售须指定好友，公开寄售不指定买家',
  );


export type AuctionListRequest = z.infer<typeof AuctionListSchema>;


export const AuctionBuySchema = z
  .object({
    listingId: z.uuid(),
    quantity: z.number().int().min(1).max(AUCTION_MAX_PURCHASE_QUANTITY),
    requestId: z.uuid(),
  })
  .strict();


export const AuctionBeastListSchema = z
  .strictObject({
    requestId: z.uuid(),
    beastId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    price: z.number().int().min(1).max(AUCTION_MAX_UNIT_PRICE),
    visibility: z.enum(['public', 'private']).default('public'),
    targetCultivatorId: z.uuid().optional(),
  })
  .refine(
    (v) =>
      v.visibility === 'private'
        ? !!v.targetCultivatorId
        : !v.targetCultivatorId,
    '专属寄售须指定好友，公开寄售不指定买家',
  );


export type AuctionBeastListRequest = z.infer<typeof AuctionBeastListSchema>;



type AuctionListingBase = {
  id: string;
  sellerId: string;
  sellerName: string;
  itemName: string;
  itemQuality: string;
  itemCategory: string;
  price: number;
  remainingQuantity: number;
  visibility: 'public' | 'private';
  targetCultivatorId: string | null;
  targetCultivatorName: string | null;
  expiresAt: string;
};



export type AuctionListingView = AuctionListingBase &
  (
    | {
        itemType: Exclude<AuctionItemType, 'beast'>;
        item: {
          name: string;
          definitionId: string;
          instanceData: unknown;
          quantity: number;
        };
      }
    | { itemType: 'beast'; beast: BeastTradePreview }
  );
