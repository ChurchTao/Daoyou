import type { InventoryView } from '@shared/contracts/inventory';
import { itemDefinition } from '@shared/inventory';
import {
  INVENTORY_MATERIAL_TYPES,
  MaterialFactsSchema,
} from '@shared/items/definitions/materials';
import { QUALITY_VALUES, type Quality } from '@shared/types/constants';

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
export type MaterialType = (typeof INVENTORY_MATERIAL_TYPES)[number];
export type InventoryFilter = {
  kind: InventoryKind;
  minRank?: Quality;
  maxRank?: Quality;
  materialType?: MaterialType;
};

export const defaultInventoryFilter: InventoryFilter = { kind: 'all' };

export function inventoryFilterActive(filter: InventoryFilter) {
  return (
    filter.kind !== 'all' ||
    !!filter.minRank ||
    !!filter.maxRank ||
    !!filter.materialType
  );
}

export function matchesInventoryFilters(item: Item, filter: InventoryFilter) {
  const kind = itemDefinition(item.definitionId).kind;
  if (filter.kind !== 'all' && kind !== filter.kind) return false;
  if (filter.kind !== 'material') return true;
  const facts = MaterialFactsSchema.safeParse(item.instanceData);
  if (!facts.success) return false;
  const rank = QUALITY_VALUES.indexOf(facts.data.rank);
  return (
    (!filter.minRank || rank >= QUALITY_VALUES.indexOf(filter.minRank)) &&
    (!filter.maxRank || rank <= QUALITY_VALUES.indexOf(filter.maxRank)) &&
    (!filter.materialType || facts.data.type === filter.materialType)
  );
}
