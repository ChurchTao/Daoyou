import { describe, expect, it } from 'vitest';
import {
  advanceTowerRewardWeek,
  TowerClaimsSchema,
  towerRewards,
  type TowerRewardState,
} from './reward-state';

const state: TowerRewardState = {
  seasonKey: '2026-W38@Asia/Shanghai',
  claims: {
    '5': {
      battleId: null,
      claimedAt: '2026-09-19T00:00:00Z',
      reward: { floor: 5, spiritStones: 100, reputation: 5, items: [] },
    },
  },
};
describe('每角色一条周领奖状态', () => {
  it('同周重开保留资格，新周只覆盖一份状态，不修改旧输入', () => {
    expect(advanceTowerRewardWeek(state, state.seasonKey)).toEqual(state);
    expect(advanceTowerRewardWeek(state, '2026-W39@Asia/Shanghai')).toEqual({
      seasonKey: '2026-W39@Asia/Shanghai',
      claims: {},
    });
    expect(Object.keys(state.claims)).toEqual(['5']);
    expect(towerRewards(state, '2026-W39@Asia/Shanghai')).toEqual([]);
    expect(towerRewards(state, state.seasonKey)).toHaveLength(1);
  });
  it('同一条记录可保存20层领取事实，拒绝范围外楼层', () => {
    const claims = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [
        String(i + 1),
        {
          ...state.claims['5'],
          reward: { floor: i + 1, spiritStones: 90, reputation: 0, items: [] },
        },
      ]),
    );
    expect(Object.keys(TowerClaimsSchema.parse(claims))).toHaveLength(20);
    for (const key of ['0', '21', '01'])
      expect(TowerClaimsSchema.safeParse({ [key]: claims['1'] }).success).toBe(
        false,
      );
  });
  it('拒绝旧周回退与不一致的领取事实', () => {
    expect(() =>
      advanceTowerRewardWeek(state, '2026-W37@Asia/Shanghai'),
    ).toThrow('不能回退');
    expect(
      TowerClaimsSchema.safeParse({ '10': state.claims['5'] }).success,
    ).toBe(false);
    expect(
      TowerClaimsSchema.safeParse({ '1': state.claims['5'] }).success,
    ).toBe(false);
    expect(TowerClaimsSchema.safeParse(state.claims).success).toBe(true);
  });
});
