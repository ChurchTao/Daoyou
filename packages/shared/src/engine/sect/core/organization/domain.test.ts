import { describe, expect, it } from 'vitest';
import {
  ContributionBalance,
  SectMembership,
  SectStipendClaim,
  SectTask,
} from './domain.js';

describe('sect organization domain', () => {
  const stipendSnapshot = { spiritStones: 500 };
  it('protects contribution balance and promotes without consuming it', () => {
    const membership = SectMembership.rehydrate({
      id: 'member-1',
      sectId: 'fixture',
      rank: 'registered',
      contribution: 100,
    });
    membership.promote('outer', membership.evaluatePromotion([]));
    expect(membership.discipleRank()).toBe('outer');
    expect(membership.contributionBalance()).toBe(100);
    expect(() => membership.spendContribution(101, 'shop', 'purchase')).toThrow(
      '宗门贡献不足',
    );
  });

  it('separates task fulfillment from reward claiming', () => {
    const task = SectTask.offered({
      id: 'task-1',
      definitionId: 'fixture-task',
      membershipId: 'member-1',
      kind: 'daily',
      periodKey: '2026-07-19',
      target: 1,
    });
    expect(() => task.accept('2026-07-18')).toThrow('任务周期不匹配');
    task.accept('2026-07-19');
    expect(task.complete()).toBe(true);
    expect(task.complete()).toBe(false);
    expect(task.status()).toBe('claimable');
    expect(task.pullEvents().map((event) => event.type)).toEqual([
      'SectTaskFulfilled',
    ]);
    task.claim({
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      reward: {
        policyKey: 'sect.reward.realm-task',
        policyVersion: 1,
        difficulty: 'easy',
        contribution: 10,
        cultivationExp: 20,
        spiritStones: 30,
        summary: [],
      },
    });
    expect(task.status()).toBe('claimed');
    expect(task.pullEvents().map((event) => event.type)).toEqual([
      'SectTaskRewardClaimed',
    ]);
    expect(() =>
      task.claim({ userId: 'user-1', cultivatorId: 'cultivator-1' }),
    ).toThrow('已经领取');
  });

  it('rejects invalid balances', () => {
    expect(() => ContributionBalance.of(-1)).toThrow('非负整数');
  });

  it('claims one stipend only in its own week', () => {
    const claim = SectStipendClaim.rehydrate({
      membershipId: 'member-1',
      weekKey: '2026-W29',
      claimed: false,
    });
    expect(() => claim.claim('2026-W28', stipendSnapshot)).toThrow(
      '俸禄周期不匹配',
    );
    claim.claim('2026-W29', stipendSnapshot);
    expect(claim.pullEvents()).toEqual([
      {
        type: 'SectStipendClaimed',
        membershipId: 'member-1',
        weekKey: '2026-W29',
        rewardSnapshot: stipendSnapshot,
      },
    ]);
    expect(() => claim.claim('2026-W29', stipendSnapshot)).toThrow(
      '本周俸禄已经领取',
    );
  });
});
