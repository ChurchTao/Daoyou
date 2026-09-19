import type { ResourceChangeDescriptor, ResourceScope } from '@shared/contracts/resources';

type ScopedChange = ResourceChangeDescriptor & { scope: ResourceScope };

/** The condition read model includes the V6 panel; never publish a raw persisted condition as that view. */
export function withCharacterPanelInvalidations(changes: readonly ScopedChange[]): ScopedChange[] {
  const result: ScopedChange[] = [];
  const invalidated = new Set<string>();
  for (const change of changes) {
    if (change.resourceTopic !== 'player.condition') result.push(change);
    if (!['player.profile', 'player.sect-combat', 'player.condition'].includes(change.resourceTopic)) continue;
    const key = `${change.scope.kind}:${change.scope.id}`;
    if (invalidated.has(key)) continue;
    invalidated.add(key);
    result.push({ scope: change.scope, resourceTopic: 'player.condition', operation: 'invalidate', eventType: 'character.panel.changed' });
  }
  return result;
}
