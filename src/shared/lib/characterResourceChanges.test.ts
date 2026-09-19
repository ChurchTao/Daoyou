import { describe, expect, it } from 'vitest';
import type { ResourceChangeDescriptor, ResourceScope } from '@shared/contracts/resources';
import { withCharacterPanelInvalidations } from './characterResourceChanges';

const scope: ResourceScope = { kind: 'cultivator', id: 'player-1' };
const change = (resourceTopic: ResourceChangeDescriptor['resourceTopic'], id = scope.id) => ({ scope: { ...scope, id }, resourceTopic, operation: 'invalidate' as const, eventType: 'test.changed' });

describe('character panel resource invalidations', () => {
  it('refreshes the panel once per character after profile and build changes', () => {
    const result = withCharacterPanelInvalidations([change('player.profile'), change('player.sect-combat'), change('player.profile', 'player-2')]);
    expect(result.filter(c => c.resourceTopic === 'player.condition').map(c => c.scope.id)).toEqual(['player-1', 'player-2']);
  });
  it('replaces persisted condition updates with a read-model invalidation', () => {
    const result = withCharacterPanelInvalidations([{ ...change('player.condition'), resourceTopic: 'player.condition', operation: 'replace', payload: undefined }]);
    expect(result).toEqual([{ scope, resourceTopic: 'player.condition', operation: 'invalidate', eventType: 'character.panel.changed' }]);
  });
  it('does not refresh the panel for unrelated resource changes', () => {
    const input = [change('player.currency')];
    expect(withCharacterPanelInvalidations(input)).toEqual(input);
  });
});
