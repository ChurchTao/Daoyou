import { DefaultEnergyBudgeter } from '@/engine/creation-v2/budgeting/DefaultEnergyBudgeter';

describe('DefaultEnergyBudgeter', () => {
  const budgeter = new DefaultEnergyBudgeter();

  it('应基于 selection audit 回填闭环账本', () => {
    const next = budgeter.applySelectionAudit(
      {
        total: 30,
        reserved: 6,
        spent: 0,
        remaining: 24,
        initialRemaining: 24,
        allocations: [],
        rejections: [],
        sources: [{ source: '测试材料', amount: 30 }],
      },
      {
        affixes: [],
        spent: 14,
        remaining: 10,
        allocations: [
          { affixId: 'a', amount: 8 },
          { affixId: 'b', amount: 6 },
        ],
        rejections: [
          { affixId: 'c', amount: 12, reason: 'budget_exhausted' },
        ],
        exhaustionReason: 'budget_exhausted',
      },
    );

    expect(next).toMatchObject({
      spent: 14,
      remaining: 10,
      allocations: [
        { affixId: 'a', amount: 8 },
        { affixId: 'b', amount: 6 },
      ],
      rejections: [{ affixId: 'c', amount: 12, reason: 'budget_exhausted' }],
      exhaustionReason: 'budget_exhausted',
    });
  });

  it('应在显式回写 rolled affixes 时保持能量守恒', () => {
    const next = budgeter.reconcileRolledAffixes(
      {
        total: 28,
        reserved: 4,
        spent: 0,
        remaining: 24,
        initialRemaining: 24,
        allocations: [],
        rejections: [],
        sources: [{ source: '测试材料', amount: 28 }],
      },
      [
        {
          id: 'a',
          name: 'A',
          category: 'core',
          tags: [],
          weight: 100,
          energyCost: 8,
          rollScore: 1,
        },
        {
          id: 'b',
          name: 'B',
          category: 'suffix',
          tags: [],
          weight: 100,
          energyCost: 6,
          rollScore: 0.8,
        },
      ],
    );

    expect(next.spent).toBe(14);
    expect(next.remaining).toBe(10);
    expect(next.total).toBe(next.reserved + next.spent + next.remaining);
  });
});