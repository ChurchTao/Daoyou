

export const AUCTION_ITEM_TYPES = [
  'material',
  'seed',
  'consumable',
  'equipment',
  'blueprint',
  'manual_jade',
  'inscription',
  'beast_book',
  'beast_refinement',
  'beast_rejuvenation',
  'beast_lure',
  'beast',
] as const;

export type AuctionItemType = (typeof AUCTION_ITEM_TYPES)[number];

export type AuctionAssetType = 'item' | 'beast';

/** 收购单只接受身份可精确指定的品类：固定定义物品，以及可完整固化的材料与灵种。 */
export const AUCTION_BUY_ORDER_ITEM_TYPES = [
  'material',
  'seed',
  'blueprint',
  'manual_jade',
  'inscription',
  'beast_book',
  'beast_refinement',
  'beast_rejuvenation',
  'beast_lure',
] as const;

export type AuctionBuyOrderItemType =
  (typeof AUCTION_BUY_ORDER_ITEM_TYPES)[number];

export const AUCTION_BUY_ORDER_STATUSES = [
  'active',
  'filled',
  'expired',
  'cancelled',
] as const;

export type AuctionBuyOrderStatus =
  (typeof AUCTION_BUY_ORDER_STATUSES)[number];

export const AUCTION_TYPE_NAMES: Record<AuctionItemType, string> = {
  material: '材料',
  seed: '种子',
  consumable: '丹药／灵果',
  equipment: '道装',
  blueprint: '图纸',
  manual_jade: '玉简',
  inscription: '阵纹',
  beast_book: '传承灵印',
  beast_refinement: '灵露',
  beast_rejuvenation: '灵果',
  beast_lure: '引妖香',
  beast: '灵兽',
};
