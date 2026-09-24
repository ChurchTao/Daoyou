import { describe, expect, it } from 'vitest';
import { storyMarkForSignal } from './signals';

describe('story signals', () => {
  it('maps a finished craft, a cleared dungeon, and a training victory', () => {
    expect(storyMarkForSignal({ type: 'alchemy.craft.completed' })).toBe(
      'alchemy_crafted',
    );
    expect(
      storyMarkForSignal({ type: 'dungeon.run.settled', outcome: 'completed' }),
    ).toBe('dungeon_settled');
    expect(
      storyMarkForSignal({
        type: 'combat.v6.battle.finished',
        sourceType: 'training-room',
        outcome: 'victory',
      }),
    ).toBe('training_victory');
  });

  it('ignores outcomes the story does not accept', () => {
    expect(
      storyMarkForSignal({
        type: 'dungeon.run.settled',
        outcome: 'abandoned_before_battle',
      }),
    ).toBeNull();
    expect(
      storyMarkForSignal({
        type: 'combat.v6.battle.finished',
        sourceType: 'training-room',
        outcome: 'defeat',
      }),
    ).toBeNull();
    expect(
      storyMarkForSignal({
        type: 'combat.v6.battle.finished',
        sourceType: 'wild-encounter',
        outcome: 'victory',
      }),
    ).toBeNull();
  });
});
