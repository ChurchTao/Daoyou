import type { InventoryView } from '@shared/contracts/inventory';
import { itemDefinition } from '@shared/inventory';

type Item = InventoryView['items'][number];

export const inventoryKinds = [
  ['all', '全部'],
  ['beast_book', '传承灵印'],
  ['beast_refinement', '归元灵露'],
  ['manual_jade', '功法玉简'],
  ['inscription', '阵纹'],
  ['equipment', '道装'],
  ['blueprint', '图纸'],
  ['material', '材料'],
  ['seed', '灵种'],
  ['consumable', '丹药与消耗品'],
] as const;

export type InventoryKind = (typeof inventoryKinds)[number][0];

export function matchesInventoryFilters(item: Item, search: string, kind: InventoryKind) {
  return item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
    (kind === 'all' || itemDefinition(item.definitionId).kind === kind);
}
