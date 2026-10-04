import type { InventoryView } from '@daoyou/contracts/inventory';
import { itemDefinition } from '@daoyou/game-rules/inventory';
import {
  INVENTORY_KINDS,
  INVENTORY_MATERIAL_TYPES,
  MaterialFactsSchema,
} from '@daoyou/game-domain/inventory';
import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import { type ElementType } from '@daoyou/constants/elements';

type Item = InventoryView['items'][number];

export const inventoryKinds = INVENTORY_KINDS;

export type InventoryKind = (typeof inventoryKinds)[number][0];
export type MaterialType = (typeof INVENTORY_MATERIAL_TYPES)[number];
export type InventoryFilter = {
  kind: InventoryKind;
  minRank?: Quality;
  maxRank?: Quality;
  materialType?: MaterialType;
  element?: ElementType;
};

export const defaultInventoryFilter: InventoryFilter = { kind: 'all' };

export function inventoryFilterActive(filter: InventoryFilter) {
  return (
    filter.kind !== 'all' ||
    !!filter.minRank ||
    !!filter.maxRank ||
    !!filter.materialType ||
    !!filter.element
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
    (!filter.materialType || facts.data.type === filter.materialType) &&
    (!filter.element || facts.data.element === filter.element)
  );
}
