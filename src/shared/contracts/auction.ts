import { z } from 'zod';
import {
  AUCTION_MAX_PURCHASE_QUANTITY,
  AUCTION_MAX_UNIT_PRICE,
  getAuctionUnitPriceCap,
  isAuctionListableQuality,
} from '../config/auctionConfig';
import { ItemGrantSchema, itemDefinition } from '../inventory';
import { InventoryEquipmentSchema } from '../inventory/equipment';
import { ConsumableFactsSchema } from '../items/definitions/consumables';
import { SeedFactsSchema } from '../items/definitions/seeds';
import { materialFactsOf } from '../items/material';
import { findItemDefinition } from '../items/registry';
import { QUALITY_VALUES, type Quality } from '../types/constants';

export const AUCTION_ITEM_TYPES = [
  'material',
  'seed',
  'consumable',
  'equipment',
  'blueprint',
  'manual_jade',
  'beast_book',
  'beast_refinement',
] as const;
export type AuctionItemType = (typeof AUCTION_ITEM_TYPES)[number];
export const AUCTION_TYPE_NAMES: Record<AuctionItemType, string> = {
  material: '材料',
  seed: '种子',
  consumable: '丹药／灵果',
  equipment: '道装',
  blueprint: '图纸',
  manual_jade: '玉简',
  beast_book: '兽诀',
  beast_refinement: '灵露',
};
export const AuctionListSchema = z
  .object({
    requestId: z.uuid(),
    itemId: z.uuid(),
    revision: z.number().int().nonnegative(),
    price: z.number().int().min(1).max(AUCTION_MAX_UNIT_PRICE),
    quantity: z.number().int().min(1).max(99),
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
export const AuctionSnapshotSchema = z
  .object({
    version: z.literal('inventory_v1'),
    item: ItemGrantSchema,
  })
  .strict();

type AuctionItemFacts = { definitionId: string; instanceData: unknown };
/** 无品质品类保持其等级／流派体系，不合成旧式品质。 */
export function auctionItemQuality(item: AuctionItemFacts): Quality | null {
  const kind = itemDefinition(item.definitionId).kind;
  if (kind === 'material')
    return materialFactsOf(item.definitionId, item.instanceData).rank;
  if (kind === 'consumable')
    return ConsumableFactsSchema.parse(item.instanceData).quality;
  if (kind === 'seed') {
    if (
      item.instanceData &&
      typeof item.instanceData === 'object' &&
      'seedSpec' in item.instanceData
    )
      return SeedFactsSchema.parse(item.instanceData).seedSpec.plant.quality;
    return z.object({ rank: z.enum(QUALITY_VALUES) }).parse(item.instanceData)
      .rank;
  }
  return null;
}
export function auctionItemPriceCap(item: AuctionItemFacts) {
  const quality = auctionItemQuality(item);
  return quality ? getAuctionUnitPriceCap(quality) : AUCTION_MAX_UNIT_PRICE;
}
export function auctionItemCategory(item: AuctionItemFacts): string {
  const definition = itemDefinition(item.definitionId);
  switch (definition.kind) {
    case 'material':
      return materialFactsOf(item.definitionId, item.instanceData).type;
    case 'consumable':
      return ConsumableFactsSchema.parse(item.instanceData).spec.kind;
    case 'equipment':
      return InventoryEquipmentSchema.parse(item.instanceData).slot;
    case 'blueprint':
      return definition.slot!;
    default:
      return definition.kind;
  }
}
export function auctionBlockReason(
  item: AuctionItemFacts & { location: string; equipped?: boolean },
): string | null {
  if (item.location !== 'bag') return '只能寄售随身物品';
  if (item.equipped) return '已装备道装不可寄售，请先卸下';
  const definition = findItemDefinition(item.definitionId);
  if (!definition) return '该物品不支持寄售';
  if (
    definition.kind === 'consumable' &&
    !['pill', 'spirit_fruit'].includes(
      ConsumableFactsSchema.parse(item.instanceData).spec.kind,
    )
  )
    return '消耗品仅支持丹药与灵果寄售';
  const quality = auctionItemQuality(item);
  if (quality && !isAuctionListableQuality(quality))
    return `仅玄品及以上物品可寄售，当前为${quality}`;
  return null;
}

export type AuctionListingView = {
  id: string;
  sellerId: string;
  sellerName: string;
  itemType: AuctionItemType;
  itemName: string;
  itemQuality: string;
  itemCategory: string;
  item: {
    name: string;
    definitionId: string;
    instanceData: unknown;
    quantity: number;
  };
  price: number;
  remainingQuantity: number;
  visibility: 'public' | 'private';
  targetCultivatorId: string | null;
  targetCultivatorName: string | null;
  expiresAt: string;
};
