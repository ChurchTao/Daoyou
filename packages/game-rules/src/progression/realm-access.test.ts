import { describe, expect, it } from 'vitest';
import { hasReachedLateQiRefining } from './realm-access.js';

describe('hasReachedLateQiRefining', () => {
  it('炼气中期及更低不可用，炼气后期及以上可用', () => {
    expect(hasReachedLateQiRefining('炼气', '初期')).toBe(false);
    expect(hasReachedLateQiRefining('炼气', '中期')).toBe(false);
    expect(hasReachedLateQiRefining('炼气', '后期')).toBe(true);
    expect(hasReachedLateQiRefining('炼气', '圆满')).toBe(true);
    expect(hasReachedLateQiRefining('筑基', '初期')).toBe(true);
    expect(hasReachedLateQiRefining('渡劫', '圆满')).toBe(true);
  });
});
