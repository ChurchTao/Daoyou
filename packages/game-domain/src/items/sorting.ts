

export const INVENTORY_KINDS = [
  ['all', '全部'],
  ['beast_book', '传承灵印'],
  ['beast_refinement', '归元灵露'],
  ['beast_rejuvenation', '化生果'],
  ['manual_jade', '功法玉简'],
  ['inscription', '阵纹'],
  ['equipment', '道装'],
  ['blueprint', '图纸'],
  ['material', '材料'],
  ['seed', '灵种'],
  ['consumable', '丹药与消耗品'],
] as const;


export const INVENTORY_SORT_VALUES = ['updatedAt', 'quantity', 'kind'] as const;

export type InventorySort = (typeof INVENTORY_SORT_VALUES)[number];
