import { describe, expect, it } from 'vitest';
import { normalizeDungeonResourceTerminology } from './narrativeTerminology';

describe('normalizeDungeonResourceTerminology', () => {
  it.each([
    ['需尽快补充灵力或稳固根基。', '需尽快恢复法力或稳固根基。'],
    ['灵力不足，施法又会消耗灵力。', '法力不足，施法又会消耗法力。'],
    ['体内灵力已经枯竭。', '体内法力已经枯竭。'],
    ['先回补灵力，再继续深入。', '先回补法力，再继续深入。'],
  ])('normalizes resource wording in %s', (input, expected) => {
    expect(normalizeDungeonResourceTerminology(input)).toBe(expected);
  });

  it('preserves legitimate attribute and ambient energy wording', () => {
    const text = '泉眼深处仍有灵力波动，此功可提升灵力属性。';

    expect(normalizeDungeonResourceTerminology(text)).toBe(text);
  });
});
