import {
  blackMarketInspectionPlayerBody,
  normalizeBlackMarketPlayerBody,
} from './blackMarketMessages';

describe('black market player messages', () => {
  it.each([
    ['appearance', '仔细观察货物外观'],
    ['aura', '凝神感知货物灵气'],
    ['damage', '检查货物破损痕迹'],
    ['origin', '询问货物来历'],
    ['sale_reason', '询问为何出售'],
  ] as const)('renders %s as player-facing copy', (kind, expected) => {
    expect(blackMarketInspectionPlayerBody(kind)).toBe(expected);
  });

  it('normalizes inspection enums from existing Redis sessions', () => {
    expect(normalizeBlackMarketPlayerBody('查验：aura')).toBe(
      '凝神感知货物灵气',
    );
    expect(normalizeBlackMarketPlayerBody('查验：origin')).toBe('询问货物来历');
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
