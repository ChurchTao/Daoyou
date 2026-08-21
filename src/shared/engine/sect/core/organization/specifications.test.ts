import { describe, expect, it } from 'vitest';
import { PromotionRequirementSpecification } from './specifications';

describe('PromotionRequirementSpecification', () => {
  it('evaluates configurable task tags without knowing concrete task ids', () => {
    const specification = new PromotionRequirementSpecification();
    const requirement = {
      rank: 'inner' as const,
      minRealm: '筑基' as const,
      contribution: 500,
      dailyCompletions: 3,
      requiredTaskTags: [{ tag: 'fixture.trial', label: '完成夹具试炼' }],
    };
    expect(
      specification.violations(
        {
          realm: '筑基',
          stage: '初期',
          contribution: 500,
          lifetimeContribution: 500,
          dailyCompletions: 3,
          completedTaskTags: new Set(['fixture.trial']),
        },
        requirement,
      ),
    ).toEqual([]);
    expect(
      specification
        .violations(
          {
            realm: '炼气',
            stage: '初期',
            contribution: 10,
            lifetimeContribution: 10,
            dailyCompletions: 0,
            completedTaskTags: new Set(),
          },
          requirement,
        )
        .map((item) => item.code),
    ).toEqual([
      'realm',
      'contribution',
      'daily_completions',
      'task:fixture.trial',
    ]);
  });

  it('uses lifetime contribution after the spendable balance is consumed', () => {
    const specification = new PromotionRequirementSpecification();
    expect(
      specification.violations(
        {
          realm: '筑基',
          stage: '初期',
          contribution: 0,
          lifetimeContribution: 500,
          dailyCompletions: 3,
          completedTaskTags: new Set(['fixture.trial']),
        },
        {
          rank: 'inner',
          minRealm: '筑基',
          contribution: 500,
          dailyCompletions: 3,
          requiredTaskTags: [{ tag: 'fixture.trial', label: '完成夹具试炼' }],
        },
      ),
    ).toEqual([]);
  });
});
