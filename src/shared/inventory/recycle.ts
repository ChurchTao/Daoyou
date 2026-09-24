import { ConsumableFactsSchema } from '../items/definitions/consumables';
import { findItemDefinition } from '../items/registry';
import type { InventoryItem } from './index';

export function recycleBlockingReason(
  item: Pick<InventoryItem, 'location' | 'definitionId' | 'instanceData'>,
): string | null {
  if (item.location !== 'bag') return '请先取入随身物品栏。';
  if (findItemDefinition(item.definitionId)?.kind === 'material') return null;
  if (item.definitionId === 'consumable.v1') {
    const parsed = ConsumableFactsSchema.safeParse(item.instanceData);
    if (
      parsed.success &&
      ((parsed.data.type === '丹药' && parsed.data.spec.kind === 'pill') ||
        (parsed.data.type === '灵果' &&
          parsed.data.spec.kind === 'spirit_fruit'))
    )
      return null;
  }
  return '这里只收购材料、丹药与灵果，这件物品请先留好。';
}
