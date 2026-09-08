import { describe, expect, it } from 'vitest';
import { rankingDay, rankingOrderAfterBattle } from './ranking';

describe('天骄榜结算规则', () => {
  it('按上海发起日计次，跨日不受进程时区影响', () => {
    expect(rankingDay(Date.parse('2026-09-08T15:59:59Z'))).toBe('2026-09-08');
    expect(rankingDay(Date.parse('2026-09-08T16:00:00Z'))).toBe('2026-09-09');
  });
  it('获胜插到目标位置，其余顺移而非交换', () => {
    const order = ['a', 'b', 'c', 'd'];
    expect(rankingOrderAfterBattle(order, 'd', 'b', true, true).order).toEqual([
      'a',
      'd',
      'b',
      'c',
    ]);
    expect(order).toEqual(['a', 'b', 'c', 'd']);
  });
  it('榜满时新挑战者获胜挤出末位', () => {
    const order = Array.from({ length: 100 }, (_, i) => String(i));
    const result = rankingOrderAfterBattle(order, 'new', '0', true, true);
    expect(result.order).toHaveLength(100);
    expect(result.order[0]).toBe('new');
    expect(result.order).not.toContain('99');
  });
  it('失败和平局仅在有空位时补入榜尾', () => {
    expect(rankingOrderAfterBattle(['a'], 'b', 'a', false, true).change).toBe(
      'vacancy_entry',
    );
    expect(
      rankingOrderAfterBattle(
        Array.from({ length: 100 }, (_, i) => String(i)),
        'b',
        '0',
        false,
        true,
      ).challengerRank,
    ).toBeNull();
  });
  it('最新名次更高、目标离榜、跨境界均不改排名', () => {
    expect(
      rankingOrderAfterBattle(['a', 'b'], 'a', 'b', true, true).change,
    ).toBeNull();
    expect(
      rankingOrderAfterBattle(['a'], 'b', 'gone', false, true).order,
    ).toEqual(['a']);
    expect(rankingOrderAfterBattle(['a'], 'b', 'a', true, false).order).toEqual(
      ['a'],
    );
  });
});
