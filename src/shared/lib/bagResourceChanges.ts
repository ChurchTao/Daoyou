import type {
  ResourceChangeDescriptor,
  ResourceScope,
} from '../contracts/resources';

type ScopedChange = ResourceChangeDescriptor & { scope: ResourceScope };

/** Full bag views include equipped flags; invalidate once for each affected character. */
export function withBagInvalidations(
  changes: readonly ScopedChange[],
): ScopedChange[] {
  const result = [...changes];
  const invalidated = new Set(
    changes
      .filter((change) => change.resourceTopic === 'inventory.bag')
      .map((change) => change.scope.id),
  );
  for (const change of changes) {
    if (change.scope.kind !== 'cultivator' || invalidated.has(change.scope.id))
      continue;
    if (
      change.resourceTopic !== 'player.profile' &&
      !change.resourceTopic.startsWith('inventory.')
    )
      continue;
    invalidated.add(change.scope.id);
    result.push({
      scope: change.scope,
      resourceTopic: 'inventory.bag',
      operation: 'invalidate',
      eventType: 'inventory.bag.changed',
    });
  }
  return result;
}
