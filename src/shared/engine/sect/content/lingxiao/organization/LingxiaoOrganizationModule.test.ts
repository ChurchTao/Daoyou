import { describe, expect, it } from 'vitest';
import { LINGXIAO_ORGANIZATION } from './LingxiaoOrganizationModule';

describe('LingxiaoOrganizationModule', () => {
  it('centralizes V1 facility permissions by disciple rank', () => {
    const registered =
      LINGXIAO_ORGANIZATION.capabilities.snapshot('registered');
    expect(registered['sect.hall.view'].granted).toBe(true);
    expect(registered['sect.shop.use'].granted).toBe(false);
    expect(registered['sect.facility.cultivation.use'].granted).toBe(false);
    expect(registered['sect.facility.alchemy.use'].granted).toBe(false);

    const outer = LINGXIAO_ORGANIZATION.capabilities.snapshot('outer');
    expect(outer['sect.shop.use'].granted).toBe(true);
    expect(outer['sect.construction.view'].granted).toBe(true);
    expect(outer['sect.facility.cultivation.use'].granted).toBe(true);
    expect(outer['sect.facility.alchemy.use'].granted).toBe(false);

    const inner = LINGXIAO_ORGANIZATION.capabilities.snapshot('inner');
    expect(inner['sect.facility.alchemy.use'].granted).toBe(true);
    expect(inner['sect.facility.refinery.use'].granted).toBe(true);
    expect(inner['sect.cave.view'].granted).toBe(true);
  });

  it('owns rank, economy, task, and construction content', () => {
    expect(
      (['registered', 'outer', 'inner', 'true'] as const).map((rank) =>
        LINGXIAO_ORGANIZATION.ranks.methodLevelCap(rank),
      ),
    ).toEqual([45, 90, 135, 180]);
    expect(LINGXIAO_ORGANIZATION.ranks.requirement('outer')).toMatchObject({
      minRealm: '炼气',
      contribution: 100,
      dailyCompletions: 3,
    });
    expect(LINGXIAO_ORGANIZATION.ranks.requirement('inner')).toMatchObject({
      minRealm: '筑基',
      contribution: 500,
    });
    expect(LINGXIAO_ORGANIZATION.ranks.requirement('true')).toMatchObject({
      minRealm: '元婴',
      contribution: 3000,
    });
    expect(
      LINGXIAO_ORGANIZATION.ranks.requirement('true').requiredTaskTags,
    ).toContainEqual({ tag: 'promotion.elder_trial', label: '通过长老试炼' });
    expect(LINGXIAO_ORGANIZATION.tasks.get('gate_sweep')?.executorKey).toBe(
      'sect.sweep',
    );
    expect(LINGXIAO_ORGANIZATION.construction.facilities[0]?.key).toBe(
      'archive',
    );
    expect(LINGXIAO_ORGANIZATION.construction.upgradeTarget(1)).toBe(250);
    expect(
      [1, 2, 3, 4, 5].map((archiveLevel) =>
        LINGXIAO_ORGANIZATION.benefits.methodLevelCap(
          new Map([['archive', archiveLevel]]),
        ),
      ),
    ).toEqual([40, 75, 110, 145, 180]);
    const levels = new Map([
      ['archive', 5],
      ['cultivation_room', 5],
      ['workshop', 5],
      ['spirit_vein', 5],
    ]);
    expect(LINGXIAO_ORGANIZATION.benefits.methodLevelCap(levels)).toBe(180);
    expect(
      LINGXIAO_ORGANIZATION.benefits.retreatMultiplier(levels, 'outer'),
    ).toBe(1.1);
    expect(
      LINGXIAO_ORGANIZATION.benefits.craftDiscount(
        'sect.craft.alchemy',
        levels,
        'true',
      ),
    ).toEqual({
      capability: 'sect.facility.alchemy.use',
      discount: 0.2,
    });
    expect(
      LINGXIAO_ORGANIZATION.benefits.craftDiscount(
        'sect.craft.refinery',
        levels,
        'true',
      ),
    ).toEqual({
      capability: 'sect.facility.refinery.use',
      discount: 0.2,
    });
    expect(LINGXIAO_ORGANIZATION.benefits.stipendMultiplier(levels)).toBe(1.25);
  });

  it('declares independent battle and material bounties', () => {
    const battle = LINGXIAO_ORGANIZATION.tasks.get('weekly_bounty_battle');
    const material = LINGXIAO_ORGANIZATION.tasks.get('weekly_bounty_material');

    expect(battle).toMatchObject({
      kind: 'weekly',
      enrollment: 'manual',
      executorKey: 'sect.battle',
      minimumDifficulty: 'hard',
      reward: {
        policy: 'sect.reward.realm-task',
        input: { baseContribution: 20 },
      },
      completionTags: ['promotion.bounty'],
    });
    expect(material).toMatchObject({
      kind: 'weekly',
      enrollment: 'manual',
      executorKey: 'sect.delivery.material',
      minimumDifficulty: 'hard',
      offer: {
        policy: 'sect.offer.delivery',
        input: { kind: 'material' },
      },
      reward: {
        policy: 'sect.reward.realm-task',
        input: { baseContribution: 20 },
      },
      completionTags: ['promotion.bounty'],
    });
    expect(
      LINGXIAO_ORGANIZATION.tasks
        .listByCompletionTag('promotion.bounty')
        .map((task) => task.id),
    ).toEqual(['weekly_bounty_battle', 'weekly_bounty_material']);
  });
});
