import { describe, expect, it } from 'vitest';
import { getBodyCultivationLevelCapByCultivationRealm } from './config.js';
import { advanceBodyCultivationTrack } from './progress.js';

describe('body cultivation realm caps', () => {
  it.each([
    ['炼气', 10],
    ['筑基', 15],
    ['金丹', 22],
    ['元婴', 30],
    ['化神', 45],
    ['炼虚', 45],
    ['合体', 60],
    ['大乘', 60],
    ['渡劫', 60],
  ] as const)('%s permits Lv.%s without title requirements', (realm, cap) => {
    expect(getBodyCultivationLevelCapByCultivationRealm(realm)).toBe(cap);
  });
  it.each([1, 100, 100000])(
    'allows 59 → 60 with %s progress and discards overflow',
    (value) => {
      const state = { level: 59, progress: 4229 };
      const result = advanceBodyCultivationTrack(state, value, '合体');
      expect(result.state).toEqual({ level: 60, progress: 0 });
      expect(result.levelUps).toEqual([60]);
      expect(result.unusedProgress).toBe(value - 1);
      expect(state).toEqual({ level: 59, progress: 4229 });
    },
  );
  it('does not add progress or levels at the realm cap', () => {
    expect(
      advanceBodyCultivationTrack({ level: 60, progress: 0 }, 100, '合体'),
    ).toEqual({
      state: { level: 60, progress: 0 },
      levelUps: [],
      unusedProgress: 100,
    });
  });
  it('continues across former title caps and carries normal overflow', () => {
    expect(
      advanceBodyCultivationTrack({ level: 5, progress: 449 }, 2, '炼气'),
    ).toMatchObject({
      state: { level: 6, progress: 1 },
      levelUps: [6],
      unusedProgress: 0,
    });
  });
});
