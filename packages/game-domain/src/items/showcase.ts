import type { InventoryItem } from './inventory.js';

export type InventoryShowcaseSnapshot = Pick<
  InventoryItem,
  'definitionId' | 'quantity' | 'instanceData'
> & { name: string };

export interface InventoryShowcasePayload {
  version: 1;
  snapshot: InventoryShowcaseSnapshot;
  text?: string;
}

/** Input is the server's public inventory view, including redacted seed facts. */
export function inventoryShowcaseSnapshot(
  item: InventoryItem & { name: string },
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
): payload is InventoryShowcasePayload {
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
