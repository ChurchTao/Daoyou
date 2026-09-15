import { emptySlot, InventoryRuleError, type InventoryItem } from './index';

/** Plan bag/equipment locations without changing the caller's inventory. */
export function changeEquipmentLocation(
  items: InventoryItem[],
  itemId: string,
  equipped: boolean,
  previousId?: string,
): InventoryItem[] {
  const item = items.find((entry) => entry.id === itemId);
  if (!item || item.definitionId !== 'equipment.v6')
    throw new InventoryRuleError('道装不存在');
  if (item.location !== (equipped ? 'bag' : 'equipped'))
    throw new InventoryRuleError('道装位置已变化，请刷新');
  const previous =
    previousId && previousId !== itemId
      ? items.find((entry) => entry.id === previousId)
      : undefined;
  if (equipped && previousId && (!previous || previous.location !== 'equipped'))
    throw new InventoryRuleError('已穿戴道装已变化，请刷新');
  const slot = equipped ? item.slotIndex : emptySlot(items);
  if (slot === null)
    throw new InventoryRuleError('背包已满，请先腾出一格再卸下');
  return items.map((entry) => {
    if (entry.id === itemId)
      return {
        ...entry,
        location: equipped ? 'equipped' : 'bag',
        slotIndex: equipped ? null : slot,
        revision: entry.revision + 1,
      };
    if (equipped && entry.id === previous?.id)
      return {
        ...entry,
        location: 'bag',
        slotIndex: slot,
        revision: entry.revision + 1,
      };
    return entry;
  });
}
