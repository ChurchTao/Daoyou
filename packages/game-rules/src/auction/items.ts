import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import { AUCTION_CATALOG_UNIT_PRICE_CAP } from '@daoyou/game-content/auction/config';
import { findItemDefinition } from '@daoyou/game-content/items';
import {
  AUCTION_BUY_ORDER_ITEM_TYPES,
  AUCTION_MAX_SELLER_RECEIPT,
  AUCTION_MAX_TRANSACTION_TOTAL,
  AUCTION_MAX_UNIT_PRICE,
  type AuctionMaterialCondition,
} from '@daoyou/game-domain/auction';
import {
  ConsumableFactsSchema,
  MaterialFactsSchema,
  SeedFactsSchema,
  materialFactsOf,
  type ItemDefinition,
} from '@daoyou/game-domain/inventory';
import { z } from 'zod';
import { BeastTransferSchema } from '../beasts/trade.js';
import { inventoryStackIdentity } from '../inventory/stack-key.js';
import { InventoryEquipmentSchema } from '../inventory/equipment.js';
import { ItemGrantSchema, itemDefinition } from '../inventory/index.js';
import {
  calculateAuctionSettlement,
  getAuctionUnitPriceCap,
  isAuctionListableQuality,
} from './settlement.js';

/** 没有品质锚、价值随个体或功法／技能身份变化的品类。 */
const AUCTION_APPRAISAL_KINDS = new Set<ItemDefinition['kind']>([
  'equipment',
  'manual_jade',
  'beast_book',
]);

/** 单次上架件数以该物品的背包堆叠上限为准，不另设固定件数。 */
export function auctionListingStackLimit(definitionId: string): number {
  return itemDefinition(definitionId).stackLimit;
}

/**
 * 高出原目录上限的成交，卖家到手不能超过单次灵石入账上限。
 * 材料等原价档保持既有件数规则，不在这里收紧。
 */
export function auctionSellerReceiptAllows(
  unitPrice: number,
  quantity: number,
): boolean {
  if (unitPrice <= AUCTION_CATALOG_UNIT_PRICE_CAP) return true;
  return (
    calculateAuctionSettlement(unitPrice, quantity).sellerAmount <=
    AUCTION_MAX_SELLER_RECEIPT
  );
}

/** 单次购买件数与上架对齐：不超过该物品堆叠上限和货单剩余，高单价再受单次成交总额约束。 */
export function auctionPurchaseQuantityLimit(input: {
  definitionId: string;
  remainingQuantity: number;
  unitPrice: number;
}): number {
  const unitPrice = Math.max(0, Math.floor(input.unitPrice));
  const affordable =
    unitPrice > 0 ? Math.floor(AUCTION_MAX_TRANSACTION_TOTAL / unitPrice) : 0;
  let limit = Math.max(
    0,
    Math.min(
      auctionListingStackLimit(input.definitionId),
      Math.floor(input.remainingQuantity),
      affordable,
    ),
  );
  while (limit > 0 && !auctionSellerReceiptAllows(unitPrice, limit)) {
    limit -= 1;
  }
  return limit;
}

const AuctionInventoryGrantSchema = ItemGrantSchema.extend({
  quantity: z.number().int().positive().max(2_147_483_647),
});

export const AuctionSnapshotSchema = z
  .discriminatedUnion('version', [
    z.strictObject({
      version: z.literal('inventory_v1'),
      item: AuctionInventoryGrantSchema,
    }),
    z.strictObject({
      version: z.literal('beast_v1'),
      beast: BeastTransferSchema,
    }),
  ])
  .superRefine((snapshot, ctx) => {
    if (snapshot.version !== 'inventory_v1') return;
    const definition = findItemDefinition(snapshot.item.definitionId);
    if (!definition) {
      ctx.addIssue({ code: 'custom', message: '未知物品定义' });
      return;
    }
    if (snapshot.item.quantity > definition.stackLimit)
      ctx.addIssue({ code: 'custom', message: '超过堆叠上限' });
  });

type AuctionItemFacts = { definitionId: string; instanceData: unknown };

/** 无品质品类保持其等级／流派体系，不合成旧式品质。 */
export function auctionItemQuality(item: AuctionItemFacts): Quality | null {
  const kind = itemDefinition(item.definitionId).kind;
  if (kind === 'material') return materialFactsOf(item.instanceData).rank;
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
  if (quality) return getAuctionUnitPriceCap(quality);
  const kind = itemDefinition(item.definitionId).kind;
  return AUCTION_APPRAISAL_KINDS.has(kind)
    ? AUCTION_MAX_UNIT_PRICE
    : AUCTION_CATALOG_UNIT_PRICE_CAP;
}

export function auctionItemCategory(item: AuctionItemFacts): string {
  const definition = itemDefinition(item.definitionId);
  switch (definition.kind) {
    case 'material':
      return materialFactsOf(item.instanceData).type;
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

/** 灵兽、道装与丹药／灵果无法用固定事实精确指定收购，暂不开放。 */
const AUCTION_BUY_ORDER_KINDS = new Set<ItemDefinition['kind']>(
  AUCTION_BUY_ORDER_ITEM_TYPES,
);

export function isAuctionBuyOrderKind(kind: ItemDefinition['kind']): boolean {
  return AUCTION_BUY_ORDER_KINDS.has(kind);
}

export function auctionBuyOrderTargetBlockReason(item: {
  definitionId: string;
  instanceData: unknown;
}): string | null {
  const definition = findItemDefinition(item.definitionId);
  if (!definition) return '该物品不支持收购';
  if (!isAuctionBuyOrderKind(definition.kind)) return '该物品不支持收购';
  const instanceData = item.instanceData ?? null;
  if (definition.kind === 'material') {
    if (!MaterialFactsSchema.safeParse(instanceData).success)
      return '材料属性无效';
  } else if (definition.kind === 'seed') {
    if (!SeedFactsSchema.safeParse(instanceData).success)
      return '灵种属性无效';
  } else if (instanceData !== null) {
    return '固定物品不能附带个体属性';
  }
  const quality = auctionItemQuality({ definitionId: definition.id, instanceData });
  if (quality && !isAuctionListableQuality(quality))
    return `仅玄品及以上物品可收购，当前为${quality}`;
  if (inventoryStackIdentity(definition.id, instanceData) === null)
    return '该物品不支持收购';
  return null;
}

/** 条件收购只接受材料，且材料品质仍需满足寄售门槛。 */
export function auctionMaterialConditionBlockReason(
  condition: AuctionMaterialCondition,
): string | null {
  if (!isAuctionListableQuality(condition.quality))
    return `仅玄品及以上材料可收购，当前为${condition.quality}`;
  return null;
}

/** 条件收购只比较品质、类型与五行，名称和描述不参与匹配。 */
export function auctionMaterialConditionMatches(
  condition: AuctionMaterialCondition,
  item: { definitionId: string; instanceData: unknown },
): boolean {
  if (item.definitionId !== 'material.v1') return false;
  const parsed = MaterialFactsSchema.safeParse(item.instanceData);
  if (!parsed.success) return false;
  const facts = parsed.data;
  if (condition.quality !== facts.rank) return false;
  if (condition.type !== null && condition.type !== facts.type) return false;
  if (condition.element === 'any') return true;
  if (condition.element === 'none') return facts.element === null;
  return condition.element === facts.element;
}

/** 收购目标必须能落到背包堆叠身份，卖家只有完全同款才能供货。 */
export function auctionBuyOrderTargetStackKey(item: {
  definitionId: string;
  instanceData: unknown;
}): string | null {
  return inventoryStackIdentity(item.definitionId, item.instanceData ?? null);
}

export function auctionBuyOrderMatchesItem(
  order: { definitionId: string; stackKey: string },
  item: { definitionId: string; instanceData: unknown },
): boolean {
  if (order.definitionId !== item.definitionId) return false;
  return (
    inventoryStackIdentity(item.definitionId, item.instanceData ?? null) ===
    order.stackKey
  );
}
