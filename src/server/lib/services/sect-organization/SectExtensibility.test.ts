import { FIXTURE_SECT_MODULE } from '@shared/engine/sect/testing/fixtures/FixtureSectModule';
import { describe, expect, it, vi } from 'vitest';
import { SectBenefitService } from './SectBenefitService';
import { SectConstructionApplicationService } from './SectConstructionApplicationService';
import { SectEconomyApplicationService } from './SectEconomyApplicationService';
import { SectMembershipApplicationService } from './SectMembershipApplicationService';
import {
  composeSectOrganizationPlugins,
  CORE_SECT_ORGANIZATION_PLUGIN,
} from './SectOrganizationPlugins';
import { FIXTURE_SECT_ORGANIZATION_PLUGIN } from './testing/FixtureSectOrganizationPlugin';
import type {
  Clock,
  SectConstructionCommandContext,
  SectConstructionProjectRecord,
  SectEconomyCommandContext,
} from './ports';

const clock: Clock = {
  now: () => new Date('2026-07-19T00:00:00.000Z'),
  dateKey: () => '2026-07-19',
  weekKey: () => '2026-W29',
};
const modules = { require: () => FIXTURE_SECT_MODULE.organization };
const plugins = composeSectOrganizationPlugins({
  organizations: [{
    sectId: 'fixture-sect',
    organization: FIXTURE_SECT_MODULE.organization,
  }],
  manifests: [
    CORE_SECT_ORGANIZATION_PLUGIN,
    FIXTURE_SECT_ORGANIZATION_PLUGIN,
  ],
});

describe('fixture sect organization extensions', () => {
  it('purchases a custom product through the real economy application service', async () => {
    let purchased = 0;
    const grantMaterial = vi.fn(async () => undefined);
    const context: SectEconomyCommandContext = {
      clock,
      modules,
      ids: { next: () => 'reward-1' },
      memberships: {
        findByCultivator: async () => ({
          id: 'membership-1',
          sectId: 'fixture-sect',
          cultivatorId: 'cultivator-1',
          discipleRank: 'registered',
          contribution: 30,
        }),
        countCompletedDailyTasks: async () => 0,
        hasCompletedTask: async () => false,
      },
      facilities: { ensure: async () => undefined, list: async () => [] },
      economy: {
        purchasedQuantity: async () => purchased,
        spendContribution: async () => true,
        recordPurchase: async (_membershipId, _weekKey, _itemId, quantity) => {
          purchased += quantity;
          return true;
        },
        hasClaimedStipend: async () => false,
        recordStipendClaim: async () => true,
        spendSpiritStones: async () => true,
      },
      rewards: {
        grantContribution: async () => undefined,
        grantSpiritStones: async () => undefined,
        grantCultivationExp: async () => undefined,
        grantMaterial,
        grantPill: async () => undefined,
      },
    };
    const service = new SectEconomyApplicationService(
      new SectBenefitService(),
      plugins.rewardGrants,
      plugins.events,
    );
    const result = await service.purchaseShopItem(
      'user-1',
      'cultivator-1',
      'fixture_herb',
      1,
      context,
    );
    expect(result.items[0]?.purchased).toBe(1);
    expect(grantMaterial).toHaveBeenCalledWith(
      'cultivator-1',
      expect.objectContaining({ name: '夹具灵草', quantity: 1 }),
    );
  });

  it('opens and completes a custom facility project through the real construction service', async () => {
    let project: SectConstructionProjectRecord | null = null;
    let donated = 0;
    const spendSpiritStones = vi.fn(async () => true);
    const grantContribution = vi.fn(async () => undefined);
    const context: SectConstructionCommandContext = {
      clock,
      modules,
      memberships: {
        findByCultivator: async () => ({
          id: 'membership-1',
          sectId: 'fixture-sect',
          cultivatorId: 'cultivator-1',
          discipleRank: 'outer',
          contribution: 30,
        }),
        countCompletedDailyTasks: async () => 0,
        hasCompletedTask: async () => false,
      },
      facilities: {
        ensure: async () => undefined,
        list: async () => [
          {
            sectId: 'fixture-sect',
            facilityKey: 'fixture_observatory',
            level: 1,
            updatedAt: new Date(0),
          },
        ],
      },
      construction: {
        findActiveProject: async () => project,
        findLatestCompletedProject: async () => null,
        async createProject(input) {
          project = {
            id: 'project-1',
            ...input,
            progress: 0,
            status: 'active',
            completedAt: null,
          };
          return project;
        },
        countRecentlyActiveMembers: async () => 1,
        async saveProjectProgress(_projectId, progress) {
          if (!project) return null;
          project = {
            ...project,
            progress,
          };
          return project;
        },
        async completeProject(_projectId, completedAt) {
          if (!project) return null;
          project = { ...project, status: 'completed', completedAt };
          return project;
        },
        upgradeFacility: async () => true,
        donatedContribution: async () => donated,
        recordDonation: async (input) => {
          donated += input.contribution;
          return { id: 'donation-1' };
        },
        listRecentDonations: async () => [],
        grantContribution,
      },
      economy: { spendSpiritStones },
      inventory: {
        findMaterial: async () => null,
        findConsumable: async () => null,
        findArtifact: async () => null,
        consumeMaterial: async () => false,
        consumeConsumable: async () => false,
        consumeArtifact: async () => false,
      },
    };
    const service = new SectConstructionApplicationService(
      new SectBenefitService(),
      plugins.donations,
      plugins.events,
    );
    const result = await service.donate(
      'cultivator-1',
      { demandId: 'fixture_stones', quantity: 1 },
      context,
    );
    expect(project).toMatchObject({
      facilityKey: 'fixture_observatory',
      status: 'completed',
    });
    expect(result.donatedContributionToday).toBe(1);
    expect(spendSpiritStones).toHaveBeenCalledWith('cultivator-1', 1);
    expect(grantContribution).toHaveBeenCalledWith(
      'membership-1',
      1,
      'construction_donation',
      'donation-1',
    );
  });

  it('uses one structured stipend quote for preview, audit and grants', async () => {
    const recordStipendClaim = vi.fn(async () => true);
    const grantSpiritStones = vi.fn(async () => undefined);
    const grantMaterial = vi.fn(async () => undefined);
    const membership = {
      id: 'membership-1',
      sectId: 'fixture-sect',
      cultivatorId: 'cultivator-1',
      discipleRank: 'registered' as const,
      contribution: 30,
    };
    const memberships = {
      findByCultivator: async () => membership,
      countCompletedDailyTasks: async () => 0,
      hasCompletedTask: async () => false,
      loadState: async () => ({
        membershipId: membership.id,
        sectId: membership.sectId,
        status: 'active' as const,
        contribution: membership.contribution,
        discipleRank: membership.discipleRank,
        office: 'none' as const,
        configVersion: 1,
        methods: {},
        paths: [],
        abilityLoadout: [null, null, null, null] as [null, null, null, null],
      }),
      listMembers: async () => ({ rows: [], total: 0 }),
    };
    const facilities = {
      ensure: async () => undefined,
      list: async () => [],
    };
    const economy = {
      purchasedQuantity: async () => 0,
      hasClaimedStipend: async () => false,
      spendContribution: async () => true,
      recordPurchase: async () => true,
      recordStipendClaim,
      spendSpiritStones: async () => true,
    };
    const rewards = {
      grantContribution: async () => undefined,
      grantSpiritStones,
      grantCultivationExp: async () => undefined,
      grantMaterial,
      grantPill: async () => undefined,
    };
    const overview = await new SectMembershipApplicationService(
      new SectBenefitService(),
      plugins.events,
    ).getOverview(
      {
        id: 'cultivator-1',
        realm: '炼气',
        realm_stage: '初期',
      },
      20,
      {
        clock,
        modules,
        memberships,
        facilities,
        economy,
        construction: { findActiveProject: async () => null },
      },
    );
    const claimed = await new SectEconomyApplicationService(
      new SectBenefitService(),
      plugins.rewardGrants,
      plugins.events,
    ).claimStipend('user-1', 'cultivator-1', {
      clock,
      modules,
      memberships,
      facilities,
      economy,
      rewards,
      ids: { next: () => 'reward-1' },
    });

    expect(claimed.rewards).toEqual(overview.stipend.rewards);
    expect(claimed.rewards).toEqual([
      { kind: 'spirit_stones', name: '灵石', quantity: 1, summary: '灵石 ×1' },
      { kind: 'fixture.material', name: '样例灵草', quantity: 1, summary: '样例灵草 ×1' },
    ]);
    expect(recordStipendClaim).toHaveBeenCalledWith(expect.objectContaining({
      spiritStones: 1,
      rewards: [
        expect.objectContaining({ quantity: 1, grant: expect.objectContaining({ kind: 'spirit_stones' }) }),
        expect.objectContaining({ quantity: 1, grant: expect.objectContaining({ kind: 'fixture.material' }) }),
      ],
    }));
    expect(grantSpiritStones).toHaveBeenCalledWith('cultivator-1', 1);
    expect(grantMaterial).toHaveBeenCalledWith(
      'cultivator-1',
      expect.objectContaining({ name: '样例灵草', quantity: 1 }),
    );
  });
});
