import {
  DIVINATION_OMENS,
  divinationDayKey,
  divinationRewardFacts,
  resolveDivination,
  type DivinationDice,
} from './divination';

describe('每日求签', () => {
  it('全部216种结果覆盖26个卦象，只有六六六发大聚灵符，排列不改变卦象', () => {
    const seen = new Set<string>();
    let jackpot = 0;
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
          }
        }
    expect(DIVINATION_OMENS).toHaveLength(26);
    expect(seen.size).toBe(26);
    expect(jackpot).toBe(1);
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
});
