import { describe, expect, it } from 'vitest';
import { storyMarkForSignal } from './signals';

describe('story signals', () => {
  it('maps a finished craft and a cleared dungeon', () => {
    expect(storyMarkForSignal({ type: 'alchemy.craft.completed' })).toBe(
      'alchemy_crafted',
    );
    expect(
      storyMarkForSignal({ type: 'dungeon.run.settled', outcome: 'completed' }),
    ).toBe('dungeon_settled');
    expect(
      storyMarkForSignal({ type: 'wild.searched', nodeId: 'SAT_TN_08' }),
    ).toBe('qingxi_sought');
  });

  it('ignores a search on another slope', () => {
    expect(
      storyMarkForSignal({ type: 'wild.searched', nodeId: 'SAT_TN_03' }),
    ).toBeNull();
  });

  it('ignores a dungeon left before the end', () => {
    expect(
      storyMarkForSignal({
        type: 'dungeon.run.settled',
        outcome: 'abandoned_before_battle',
      }),
    ).toBeNull();
  });
});
