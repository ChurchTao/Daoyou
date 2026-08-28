import { describe, expect, it } from 'vitest';
import { selectActivityStoryDungeonNode } from './mapSystem';

describe('activity story dungeon assignment', () => {
  it('stably assigns a same-realm dungeon to one activity story', () => {
    const first = selectActivityStoryDungeonNode('炼气', 'story-intent-1');
    const retry = selectActivityStoryDungeonNode('炼气', 'story-intent-1');

    expect(first).toBeDefined();
    expect(retry?.id).toBe(first?.id);
    expect(first?.realm_requirement).toBe('炼气');
    expect(['easy', 'normal']).toContain(
      first?.dungeon_config?.difficulty ?? 'normal',
    );
  });
});
