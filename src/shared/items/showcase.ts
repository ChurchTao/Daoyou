import type { InventoryView } from '../contracts/inventory';
import type { WorldChatItemShowcasePayload } from '../types/world-chat';

export type InventoryShowcaseSnapshot = Pick<
  InventoryView['items'][number],
  'name' | 'definitionId' | 'quantity' | 'instanceData'
>;

/** Input is the server's public inventory view, including redacted seed facts. */
export function inventoryShowcaseSnapshot(
  item: InventoryView['items'][number],
): InventoryShowcaseSnapshot {
  return {
    name: item.name,
    definitionId: item.definitionId,
    quantity: item.quantity,
    instanceData: structuredClone(item.instanceData),
  };
}

export function isInventoryShowcase(
  payload: unknown,
): payload is WorldChatItemShowcasePayload {
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('version' in payload) ||
    payload.version !== 1 ||
    !('snapshot' in payload)
  )
    return false;
  const snapshot = payload.snapshot;
  return (
    !!snapshot &&
    typeof snapshot === 'object' &&
    'name' in snapshot &&
    typeof snapshot.name === 'string' &&
    'definitionId' in snapshot &&
    typeof snapshot.definitionId === 'string' &&
    'quantity' in snapshot &&
    typeof snapshot.quantity === 'number' &&
    'instanceData' in snapshot
  );
}
