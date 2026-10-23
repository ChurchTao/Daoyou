import { type DivinationDice } from '@daoyou/game-domain/divination';
import { DIVINATION_OMENS } from '@daoyou/game-content/divination';
import {
  divinationDayKey,
  divinationRewardFacts,
  resolveDivination,
} from './rules.js';

describe('每日求签', () => {
  it('全部216种结果覆盖26个卦象，六六六发大符，其余三同发中符，排列不改变卦象', () => {
    const seen = new Set<string>();
    let jackpot = 0;
    let medium = 0;
    let small = 0;
    for (let a = 1; a <= 6; a++)
      for (let b = 1; b <= 6; b++)
        for (let c = 1; c <= 6; c++) {
          const result = resolveDivination([a, b, c]);
          expect(result.omen).toBeDefined();
          seen.add(result.omen.id);
          expect(resolveDivination([c, a, b])).toEqual(result);
          expect(result.total).toBe(a + b + c);
          if (result.rewardScenario === 'qi_restore_large') {
            jackpot++;
            expect([a, b, c]).toEqual([6, 6, 6]);
          } else if (result.rewardScenario === 'qi_restore_medium') {
            medium++;
            expect(a).toBe(b);
            expect(b).toBe(c);
            expect(a).toBeLessThan(6);
          } else {
            small++;
            expect(a === b && b === c).toBe(false);
          }
        }
    expect(DIVINATION_OMENS).toHaveLength(26);
    expect(seen.size).toBe(26);
    expect(jackpot).toBe(1);
    expect(medium).toBe(5);
    expect(small).toBe(210);
  });

  it.each([
    [0, 1, 2],
    [7, 6, 6],
    [1.5, 2, 3],
  ])('拒绝非法骰子 %j', (...dice) => {
    expect(() => resolveDivination(dice as DivinationDice)).toThrow();
  });

  it('按北京时间零点换日', () => {
    expect(divinationDayKey(new Date('2026-09-19T15:59:59Z'))).toBe(
      '2026-09-19',
    );
    expect(divinationDayKey(new Date('2026-09-19T16:00:00Z'))).toBe(
      '2026-09-20',
    );
  });

  it('奖励使用现有可在背包直接使用的聚灵符协议', () => {
    expect(divinationRewardFacts([1, 2, 3]).spec).toEqual({
      kind: 'talisman',
      scenario: 'qi_restore_small',
      sessionMode: 'consume_on_action',
    });
    expect(divinationRewardFacts([6, 6, 6]).name).toBe('大聚灵符');
  });

  it.each([1, 2, 3, 4, 5])('三枚骰子均为 %i 时奖励中聚灵符', (value) => {
    const reward = divinationRewardFacts([value, value, value]);
    expect(reward.name).toBe('中聚灵符');
    expect(reward.spec).toEqual({
      kind: 'talisman',
      scenario: 'qi_restore_medium',
      sessionMode: 'consume_on_action',
    });
  });
});
