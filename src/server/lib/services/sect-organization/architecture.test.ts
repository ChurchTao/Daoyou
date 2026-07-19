import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { SectOrganizationFacade } from './SectOrganizationFacade';

const applicationFiles = [
  './SectMembershipApplicationService.ts',
  './SectTaskApplicationService.ts',
  './SectEconomyApplicationService.ts',
  './SectConstructionApplicationService.ts',
  './SectOrganizationFacade.ts',
  './SectOrganizationSupport.ts',
  './SectTaskWorkflow.ts',
];

describe('sect organization architecture', () => {
  it('keeps concrete sect names and task identifiers out of application services', () => {
    const source = applicationFiles
      .map((path) =>
        readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8'),
      )
      .join('\n');
    expect(source).not.toMatch(/凌霄|lingxiao/iu);
    expect(source).not.toMatch(
      /['"](?:gate_sweep|mine_patrol|pill_delivery|artifact_delivery|weekly_tournament|weekly_bounty|elder_trial)['"]/u,
    );
  });

  it('composes all application services from an injected implementation', async () => {
    const taskOperations = {
      getTasks: vi.fn(async () => ({ dateKey: 'fixture' })),
      acceptDaily: vi.fn(),
      startSweep: vi.fn(),
      completeSweep: vi.fn(),
      submitTaskItem: vi.fn(),
      challengeTask: vi.fn(),
    };
    const facade = new SectOrganizationFacade({
      membership: {
        getOverview: vi.fn(),
        promote: vi.fn(),
        listMembers: vi.fn(),
      } as never,
      tasks: taskOperations as never,
      economy: {
        getShop: vi.fn(),
        purchaseShopItem: vi.fn(),
        claimStipend: vi.fn(),
      } as never,
      construction: {
        ensureWeeklyProject: vi.fn(),
        getConstruction: vi.fn(),
        donate: vi.fn(),
      } as never,
      benefits: {
        getBonuses: vi.fn(),
        applyCraftDiscount: vi.fn(),
      } as never,
      getExecutor: vi.fn(() => ({}) as never),
    });
    await facade.tasks.getTasks('fixture-cultivator');
    expect(taskOperations.getTasks).toHaveBeenCalledWith('fixture-cultivator');
  });
});
