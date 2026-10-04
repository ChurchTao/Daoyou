import { INVENTORY_KINDS, type InventorySort } from '@daoyou/game-domain/inventory';
import { itemDefinition } from './index.js';


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
