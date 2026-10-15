import type { InventoryItem } from '@daoyou/game-domain/inventory';
import { ConsumableFactsSchema } from '@daoyou/game-domain/inventory';

export const TRANSFER_STONE_LIMIT = 10_000_000;
export const TRANSFER_BAG_SLOTS = 8;

export function transferableQuantity(item: Pick<InventoryItem, 'definitionId' | 'instanceData' | 'quantity'>): number {
  if (item.definitionId === 'material.v1') return 0;
  if (item.definitionId === 'equipment.v6') return 1;
  if (item.definitionId === 'consumable.v1') {
    const facts = ConsumableFactsSchema.parse(item.instanceData);
    if (facts.spec.kind === 'talisman') return Math.min(item.quantity, 10);
  }
  return Math.min(item.quantity, 30);
}

export function transferableBagItems<T extends InventoryItem>(items: readonly T[]): T[] {
  return items
    .filter((item) => item.location === 'bag' && item.slotIndex !== null && item.slotIndex < TRANSFER_BAG_SLOTS)
    .sort((a, b) => a.slotIndex! - b.slotIndex!)
    .flatMap((item) => {
      const quantity = transferableQuantity(item);
      return quantity ? [{ ...item, quantity }] : [];
    });
}
