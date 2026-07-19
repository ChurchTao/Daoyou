import { describe, expect, it } from 'vitest';
import {
  ContributionBalance,
  SectConstructionProject,
  SectDonationOffer,
  SectMembership,
  SectShopOrder,
  SectStipendClaim,
  SectTask,
} from './domain';

describe('sect organization domain', () => {
  const donationSettlement = {
    donationId: 'donation-1',
    dateKey: '2026-07-19',
    demand: {
      id: 'herb',
      name: '灵草',
      description: '测试需求',
      kind: 'fixture.donation',
      quantity: 1,
      contribution: 10,
      constructionPoints: 20,
    },
    itemSnapshot: { itemId: 'herb-1' },
  };
  const stipendSnapshot = { spiritStones: 500, rewards: [] };
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

  it('keeps task completion idempotent and rejects a mismatched period', () => {
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
    expect(task.pullEvents()).toHaveLength(1);
  });

  it('completes a construction project once at its target', () => {
    const project = SectConstructionProject.rehydrate({
      id: 'project-1',
      sectId: 'fixture',
      facilityKey: 'archive',
      targetLevel: 2,
      target: 100,
      progress: 90,
      completed: false,
    });
    project.applyDonation('member-1', 10, 20, donationSettlement);
    expect(project.progress()).toBe(100);
    expect(project.isCompleted()).toBe(true);
    expect(project.pullEvents().map((event) => event.type)).toEqual([
      'SectDonationAccepted',
      'SectProjectCompleted',
      'SectFacilityUpgraded',
    ]);
    expect(() =>
      project.applyDonation('member-1', 10, 10, donationSettlement),
    ).toThrow('工程已经完成');
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
    expect(() => claim.claim('2026-W28', stipendSnapshot)).toThrow('俸禄周期不匹配');
    claim.claim('2026-W29', stipendSnapshot);
    expect(claim.pullEvents()).toEqual([
      {
        type: 'SectStipendClaimed',
        membershipId: 'member-1',
        weekKey: '2026-W29',
        rewardSnapshot: stipendSnapshot,
      },
    ]);
    expect(() => claim.claim('2026-W29', stipendSnapshot)).toThrow('本周俸禄已经领取');
  });

  it('quotes shop and donation commands inside the domain', () => {
    expect(
      SectShopOrder.quote({
        itemId: 'item-1',
        quantity: 2,
        purchased: 1,
        stock: 3,
        unitPrice: 20,
      }).totalCost,
    ).toBe(40);
    expect(() =>
      SectShopOrder.quote({
        itemId: 'item-1',
        quantity: 2,
        purchased: 2,
        stock: 3,
        unitPrice: 20,
      }),
    ).toThrow('库存不足');
    expect(
      SectDonationOffer.quote({
        demandId: 'demand-1',
        units: 2,
        quantityPerUnit: 3,
        contributionPerUnit: 10,
        constructionPointsPerUnit: 12,
      }),
    ).toMatchObject({ itemQuantity: 6, contribution: 20, constructionPoints: 24 });
  });
});
