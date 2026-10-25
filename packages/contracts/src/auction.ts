import type {
  AuctionBuyOrderItemType,
  AuctionItemType,
} from '@daoyou/game-domain/auction';

import { z } from 'zod';

import {
  AuctionMaterialConditionSchema,
  AUCTION_MAX_UNIT_PRICE,
  type AuctionMaterialCondition,
} from '@daoyou/game-domain/auction';

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
    quantity: z.number().int().min(1).max(2_147_483_647),
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

/**
 * 精确收购只能引用服务端已验证的背包物品或在售货单，客户端不提交物品事实；
 * 条件收购按材料条件匹配，不绑定具体物品，因此不携带 source。
 */
export const AuctionBuyOrderCreateSchema = z
  .strictObject({
    requestId: z.uuid(),
    source: z
      .discriminatedUnion('kind', [
        z.strictObject({
          kind: z.literal('bag'),
          itemId: z.uuid(),
          revision: z.number().int().nonnegative(),
        }),
        z.strictObject({
          kind: z.literal('listing'),
          listingId: z.uuid(),
        }),
      ])
      .optional(),
    targetMode: z.enum(['exact', 'condition']).default('exact'),
    condition: AuctionMaterialConditionSchema.optional(),
    price: z.number().int().min(1).max(AUCTION_MAX_UNIT_PRICE),
    quantity: z.number().int().min(1).max(2_147_483_647),
  })
  .superRefine((value, ctx) => {
    if (value.targetMode === 'condition') {
      if (!value.condition)
        ctx.addIssue({
          code: 'custom',
          path: ['condition'],
          message: '条件收购必须提供收购条件',
        });
      if (value.source)
        ctx.addIssue({
          code: 'custom',
          path: ['source'],
          message: '条件收购不需要指定具体物品',
        });
      return;
    }
    if (!value.source)
      ctx.addIssue({
        code: 'custom',
        path: ['source'],
        message: '直接收购必须选择收购目标',
      });
    if (value.condition)
      ctx.addIssue({
        code: 'custom',
        path: ['condition'],
        message: '精确收购不能附带收购条件',
      });
  });

export type AuctionBuyOrderCreateRequest = z.infer<
  typeof AuctionBuyOrderCreateSchema
>;

export const AuctionBuyOrderSupplySchema = z.strictObject({
  requestId: z.uuid(),
  itemId: z.uuid(),
  revision: z.number().int().nonnegative(),
  quantity: z.number().int().min(1).max(2_147_483_647),
});

export type AuctionBuyOrderSupplyRequest = z.infer<
  typeof AuctionBuyOrderSupplySchema
>;

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

type AuctionBuyOrderBase = {
  id: string;
  buyerId: string;
  buyerName: string;
  itemType: AuctionBuyOrderItemType;
  itemName: string;
  itemQuality: string;
  itemCategory: string;
  price: number;
  initialQuantity: number;
  remainingQuantity: number;
  expiresAt: string;
  createdAt: string;
  /** 当前查看者背包中可满足该收购单的堆叠，仅列表接口计算。 */
  supplyableQuantity: number;
  supplyableItems: Array<{
    id: string;
    quantity: number;
    revision: number;
  }>;
};

export type AuctionBuyOrderView = AuctionBuyOrderBase &
  (
    | {
        targetMode: 'exact';
        condition: null;
        item: {
          name: string;
          definitionId: string;
          instanceData: unknown;
          quantity: number;
        };
      }
    | {
        targetMode: 'condition';
        condition: AuctionMaterialCondition;
        item: null;
      }
  );
