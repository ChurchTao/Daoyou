import { describe, expect, it } from 'vitest';
import {
  activateStoredAutoStrategySlot,
  parseStoredAutoStrategyBook,
  preferDefaultAutoStrategy,
  removeAutoStrategySlot,
  saveAutoStrategySlot,
  type AutoStrategy,
} from './auto-strategy.js';

const first: AutoStrategy = {
  version: 1,
  rules: [{ conditions: [], action: { type: 'attack' }, target: 'best' }],
};
const second: AutoStrategy = {
  version: 1,
  rules: [{ conditions: [], action: { type: 'defend' }, target: 'best' }],
};

describe('auto strategy books', () => {
  it('keeps a legacy single strategy as the first active set', () => {
    expect(parseStoredAutoStrategyBook(first)).toEqual({
      version: 1,
      activeSlot: 0,
      slots: [first, null, null],
    });
  });

  it('drops an active pointer that no longer has a saved set', () => {
    expect(
      parseStoredAutoStrategyBook({
        version: 1,
        activeSlot: 1,
        slots: [first, null, null],
      }).activeSlot,
    ).toBeNull();
  });

  it('saves one set without discarding the others', () => {
    const saved = saveAutoStrategySlot(
      parseStoredAutoStrategyBook(first),
      1,
      second,
    );
    expect(saved.slots).toEqual([first, second, null]);
    expect(saved.activeSlot).toBe(1);
    expect(activateStoredAutoStrategySlot(saved, 0)?.activeSlot).toBe(0);
    expect(activateStoredAutoStrategySlot(saved, 2)).toBeNull();
  });

  it('can leave combat on the sect tactic while the saved sets remain', () => {
    const saved = saveAutoStrategySlot(
      parseStoredAutoStrategyBook(first),
      1,
      second,
    );
    const dormant = preferDefaultAutoStrategy(saved);
    expect(dormant?.activeSlot).toBeNull();
    expect(dormant?.slots).toEqual([first, second, null]);
    expect(removeAutoStrategySlot(dormant, 0)?.slots).toEqual([null, second, null]);
    expect(
      removeAutoStrategySlot(
        { version: 1, activeSlot: 0, slots: [first, null, null] },
        0,
      ),
    ).toBeNull();
  });

  it('rejects a fourth set', () => {
    expect(() =>
      parseStoredAutoStrategyBook({
        version: 1,
        activeSlot: 0,
        slots: [first, null, null, null],
      }),
    ).toThrow();
  });
});
