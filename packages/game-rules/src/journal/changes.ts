import type { JournalChange } from '@daoyou/game-domain/journal/changes';
import type { InventoryItem } from '@daoyou/game-domain/inventory';
import { findItemDefinition } from '@daoyou/game-content/items';

/** Quantity changes only: moving/equipping an existing item is not a gain. */
export function inventoryJournalChanges(
  before: readonly InventoryItem[],
  after: readonly InventoryItem[],
): JournalChange[] {
  const previous = new Map(before.map((item) => [item.id, item]));
  const next = new Map(after.map((item) => [item.id, item]));
  const changes: JournalChange[] = [];
  for (const id of new Set([...previous.keys(), ...next.keys()])) {
    const old = previous.get(id);
    const current = next.get(id);
    const amount = (current?.quantity ?? 0) - (old?.quantity ?? 0);
    if (!amount) continue;
    const item = current ?? old!;
    const facts = item.instanceData as { name?: string } | null;
    changes.push({
      kind: 'item',
      id,
      amount,
      name:
        facts?.name ??
        findItemDefinition(item.definitionId)?.name ??
        item.definitionId,
    });
  }
  return changes;
}

/** Keep costs and rewards separate, even when they concern the same item. */
export function compactJournalChanges(
  changes: readonly JournalChange[],
): JournalChange[] {
  const grouped = new Map<string, JournalChange>();
  for (const change of changes) {
    if (!change.amount) continue;
    const key = JSON.stringify([
      change.kind,
      change.kind === 'item' ? change.id : change.resource,
      Math.sign(change.amount),
    ]);
    const previous = grouped.get(key);
    grouped.set(key, {
      ...change,
      amount: (previous?.amount ?? 0) + change.amount,
    });
  }
  return [...grouped.values()];
}
