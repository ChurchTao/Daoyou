import { describe, expect, it } from 'vitest';
import { LINGXIAO_ORGANIZATION } from './LingxiaoOrganizationModule';

describe('LingxiaoOrganizationModule', () => {
  it('centralizes V1 facility permissions by disciple rank', () => {
    const registered = LINGXIAO_ORGANIZATION.capabilities.snapshot('registered');
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
    expect(LINGXIAO_ORGANIZATION.ranks.methodLevelCap('registered')).toBe(5);
    expect(LINGXIAO_ORGANIZATION.ranks.requirement('true')).toMatchObject({
      minRealm: '金丹',
      contribution: 3000,
    });
    expect(
      LINGXIAO_ORGANIZATION.ranks.requirement('true').requiredTaskTags,
    ).toContainEqual({ tag: 'promotion.elder_trial', label: '通过长老试炼' });
    expect(LINGXIAO_ORGANIZATION.tasks.get('gate_sweep')?.executorKey).toBe('sect.sweep');
    expect(LINGXIAO_ORGANIZATION.economy.donationDailyCap).toBe(60);
    expect(LINGXIAO_ORGANIZATION.construction.facilityPriority[0]).toBe('archive');
    const levels = new Map([
      ['archive', 5],
      ['cultivation_room', 5],
      ['workshop', 5],
      ['spirit_vein', 5],
    ]);
    expect(LINGXIAO_ORGANIZATION.benefits.methodLevelCap(levels)).toBe(100);
    expect(LINGXIAO_ORGANIZATION.benefits.retreatMultiplier(levels, 'outer')).toBe(1.1);
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
});
