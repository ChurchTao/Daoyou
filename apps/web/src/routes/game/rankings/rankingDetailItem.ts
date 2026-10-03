import type { ItemDetailPayload } from '@app/components/feature/items';
import { assertConsumableSpec } from '@daoyou/shared/lib/consumables';
import type { Consumable } from '@daoyou/shared/types/cultivator';
import type { ItemRankingEntry } from '@daoyou/shared/types/rankings';

export function toRankingDetailItem(item: ItemRankingEntry): ItemDetailPayload {
  const consumable: Consumable = {
    id: item.id,
    name: item.name,
    type: (item.type as Consumable['type']) || '丹药',
    quality: item.quality as Consumable['quality'],
    quantity: item.quantity || 1,
    description: item.description,
    score: item.score,
    spec: assertConsumableSpec(item.spec),
  };

  return { kind: 'inventory-consumable', item: consumable };
}
