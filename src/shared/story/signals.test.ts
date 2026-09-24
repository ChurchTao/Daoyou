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
      storyMarkForSignal({ type: 'wild.met', nodeId: 'SAT_TN_08' }),
    ).toBe('qingxi_met');
    expect(
      storyMarkForSignal({ type: 'equipment.forged', slot: 'weapon' }),
    ).toBe('weapon_forged');
  });

  it('ignores forging anything but a weapon', () => {
    expect(
      storyMarkForSignal({ type: 'equipment.forged', slot: 'armor' }),
    ).toBeNull();
  });

  it('ignores a meeting on another slope', () => {
    expect(
      storyMarkForSignal({ type: 'wild.met', nodeId: 'SAT_TN_03' }),
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
