

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
  'beast',
] as const;

export type AuctionItemType = (typeof AUCTION_ITEM_TYPES)[number];

export type AuctionAssetType = 'item' | 'beast';

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
  beast: '灵兽',
};
