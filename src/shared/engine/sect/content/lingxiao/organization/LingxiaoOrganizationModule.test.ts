import { describe, expect, it } from 'vitest';
import { LINGXIAO_ORGANIZATION } from './LingxiaoOrganizationModule';

describe('LingxiaoOrganizationModule', () => {
  it('centralizes V1 facility permissions by disciple rank', () => {
    const registered = LINGXIAO_ORGANIZATION.permissions.snapshot('registered');
    expect(registered['scene.hall'].granted).toBe(true);
    expect(registered['scene.treasury'].granted).toBe(false);
    expect(registered['scene.cultivation_room'].granted).toBe(false);
    expect(registered['scene.alchemy'].granted).toBe(false);

    const outer = LINGXIAO_ORGANIZATION.permissions.snapshot('outer');
    expect(outer['scene.treasury'].granted).toBe(true);
    expect(outer['scene.industries'].granted).toBe(true);
    expect(outer['scene.cultivation_room'].granted).toBe(true);
    expect(outer['scene.alchemy'].granted).toBe(false);

    const inner = LINGXIAO_ORGANIZATION.permissions.snapshot('inner');
    expect(inner['scene.alchemy'].granted).toBe(true);
    expect(inner['scene.refinery'].granted).toBe(true);
    expect(inner['scene.cave'].granted).toBe(true);
  });

  it('owns rank, economy, task, and construction content', () => {
    expect(LINGXIAO_ORGANIZATION.ranks.methodLevelCap('registered')).toBe(5);
    expect(LINGXIAO_ORGANIZATION.ranks.requirement('true')).toMatchObject({
      minRealm: '金丹',
      contribution: 3000,
      requiresElderTrial: true,
    });
    expect(LINGXIAO_ORGANIZATION.tasks.get('gate_sweep')?.executor).toBe('sweep');
    expect(LINGXIAO_ORGANIZATION.economy.donationDailyCap).toBe(60);
    expect(LINGXIAO_ORGANIZATION.construction.facilityPriority[0]).toBe('archive');
  });
});
