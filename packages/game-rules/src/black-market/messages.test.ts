import {
  blackMarketInspectionPlayerBody,
  normalizeBlackMarketPlayerBody,
} from './messages.js';

describe('black market player messages', () => {
  it('normalizes inspection enums from existing Redis sessions', () => {
    const normalized = normalizeBlackMarketPlayerBody('查验：aura');
    expect(normalized).toBe(blackMarketInspectionPlayerBody('aura'));
    expect(normalized).not.toBe('查验：aura');
    expect(normalizeBlackMarketPlayerBody('查验：origin')).toBe(
      blackMarketInspectionPlayerBody('origin'),
    );
  });

  it('preserves questions, offers, and unknown legacy values', () => {
    expect(normalizeBlackMarketPlayerBody('这东西从哪来的？')).toBe(
      '这东西从哪来的？',
    );
    expect(normalizeBlackMarketPlayerBody('我出八千灵石。')).toBe(
      '我出八千灵石。',
    );
    expect(normalizeBlackMarketPlayerBody('查验：unknown')).toBe(
      '查验：unknown',
    );
  });
});
