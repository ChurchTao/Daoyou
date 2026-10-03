import { itemDefinition } from './index.js';

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

type SortableItem = {
  id: string;
  definitionId: string;
  quantity: number;
  updatedAt: string;
};

/** Display order only; never changes bag slots or the shared resource snapshot. */
export function sortInventoryItems<T extends SortableItem>(
  items: T[],
  sort: InventorySort,
): T[] {
  return [...items].sort((a, b) => {
    if (sort === 'quantity' && a.quantity !== b.quantity)
      return b.quantity - a.quantity;
    if (sort === 'kind') {
      const kindOrder =
        INVENTORY_KINDS.findIndex(
          ([kind]) => kind === itemDefinition(a.definitionId).kind,
        ) -
        INVENTORY_KINDS.findIndex(
          ([kind]) => kind === itemDefinition(b.definitionId).kind,
        );
      if (kindOrder) return kindOrder;
    }
    return (
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
      (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
    );
  });
}
