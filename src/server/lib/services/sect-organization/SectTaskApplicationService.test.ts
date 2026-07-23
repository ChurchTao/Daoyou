import {
  StandardSectOrganizationModule,
  type SectOrganizationModule,
} from '@shared/engine/sect';
import { CUSTOM_ECONOMY_FIXTURE_SECT_MODULE as FIXTURE_SECT_MODULE } from '@shared/engine/sect/testing/fixtures/CustomEconomyFixtureSectModule';
import { describe, expect, it } from 'vitest';
import {
  ExecuteSectTaskActionHandler,
  GetSectTasksQueryHandler,
  ProcessSectTaskCompletionHandler,
} from './SectTaskApplicationService';
import type { SectCommandContext, SectTaskRecord } from './ports';
import {
  composeSectOrganizationPlugins,
  CORE_SECT_ORGANIZATION_PLUGIN,
} from './SectOrganizationPlugins';
import { FIXTURE_SECT_ORGANIZATION_PLUGIN } from './testing/FixtureSectOrganizationPlugin';

function fixtureContext(
  organization: SectOrganizationModule = FIXTURE_SECT_MODULE.organization,
) {
  const records: SectTaskRecord[] = [];
  const contributions: number[] = [];
  let sequence = 0;
  const memberships = {
    findByCultivator: async () => ({
      id: 'membership-1',
      cultivatorId: 'cultivator-1',
      sectId: 'fixture-sect',
      discipleRank: 'registered' as const,
      contribution: 30,
    }),
    countCompletedDailyTasks: async () => 0,
    hasCompletedTask: async () => false,
  };
  const tasks = {
    list: async () => records,
    find: async (membershipId: string, periodKey: string, taskId: string) =>
      records.find(
        (item) =>
          item.membershipId === membershipId &&
          item.periodKey === periodKey &&
          item.taskId === taskId,
      ) ?? null,
    findDaily: async (membershipId: string, dateKey: string) =>
      records.find(
        (item) => item.membershipId === membershipId && item.periodKey === dateKey,
      ) ?? null,
    countCompletedDailySince: async () => 0,
    async create(input: {
      membershipId: string;
      taskId: string;
      kind: 'daily' | 'weekly' | 'promotion';
      periodKey: string;
      progress?: number;
      payload?: Record<string, unknown>;
    }) {
      const record: SectTaskRecord = {
        id: `task-${++sequence}`,
        membershipId: input.membershipId,
        taskId: input.taskId,
        kind: input.kind,
        periodKey: input.periodKey,
        status: 'active',
        progress: input.progress ?? 0,
        payload: input.payload ?? {},
      };
      records.push(record);
      return record;
    },
    async complete(id: string, progress: number) {
      const record = records.find((item) => item.id === id);
      if (!record || record.status === 'completed') return null;
      record.status = 'completed';
      record.progress = progress;
      return record;
    },
    async updatePayload(id: string, payload: Record<string, unknown>) {
      const record = records.find((item) => item.id === id);
      if (!record) return null;
      record.payload = payload;
      return record;
    },
    async upsertProgress() {
      throw new Error('not used');
    },
  };
  const clock = {
    now: () => new Date('2026-07-19T00:00:00.000Z'),
    dateKey: () => '2026-07-19',
    weekKey: () => '2026-W29',
  };
  const modules = { require: () => organization };
  const context: SectCommandContext = {
    memberships,
    tasks,
    modules,
    clock,
    ids: { next: () => `id-${++sequence}` },
    inventory: {
      findMaterial: async () => null,
      findConsumable: async () => null,
      findArtifact: async () => null,
      consumeMaterial: async () => false,
      consumeConsumable: async () => false,
      consumeArtifact: async () => false,
    },
    cultivators: {
      loadRuntime: async () => null,
      findMirrorCultivatorId: async () => null,
      loadProgress: async () => null,
    },
    battle: { simulate: () => { throw new Error('not used'); } },
    rewards: {
      grantContribution: async (_membershipId, amount) => { contributions.push(amount); },
      grantSpiritStones: async () => undefined,
      grantCultivationExp: async () => undefined,
      grantMaterial: async () => undefined,
      grantPill: async () => undefined,
    },
  };
  return { context, records, contributions };
}

describe('sect task handlers', () => {
  it('runs a fixture task through the generic query, accept, execute and settlement flow', async () => {
    const { context, records, contributions } = fixtureContext();
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
    const query = new GetSectTasksQueryHandler(
      plugins.executors,
      plugins.progress,
    );
    const action = new ExecuteSectTaskActionHandler(
      plugins.executors,
      new ProcessSectTaskCompletionHandler(plugins.events),
    );

    const offered = await query.execute('cultivator-1', context);
    expect(offered.sections.daily[0]).toMatchObject({
      definitionId: 'fixture_patrol',
      state: 'offered',
      actions: [{ key: 'accept', renderer: 'sect.action.accept' }],
    });

    await action.execute(
      {
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        taskId: 'fixture_patrol',
        actionKey: 'accept',
        requestId: 'request-1',
        input: {},
      },
      context,
    );
    await expect(
      action.execute(
        {
          userId: 'user-1',
          cultivatorId: 'cultivator-1',
          taskId: 'fixture_patrol',
          actionKey: 'finish',
          requestId: 'request-2',
          input: { pass: false },
        },
        context,
      ),
    ).rejects.toThrow();

    const completed = await action.execute(
      {
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        taskId: 'fixture_patrol',
        actionKey: 'finish',
        requestId: 'request-3',
        input: { pass: true },
      },
      context,
    );
    expect(completed.task.state).toBe('completed');
    expect(completed.outcome).toEqual({ renderer: 'fixture-sect.outcome', data: { pass: true } });
    expect(records).toHaveLength(1);
    expect(contributions).toEqual([3]);
  });

  it('rejects duplicate executor registrations', () => {
    expect(() =>
      composeSectOrganizationPlugins({
        organizations: [{
          sectId: 'fixture-sect',
          organization: FIXTURE_SECT_MODULE.organization,
        }],
        manifests: [
          CORE_SECT_ORGANIZATION_PLUGIN,
          {
            ...FIXTURE_SECT_ORGANIZATION_PLUGIN,
            executors: [
              FIXTURE_SECT_ORGANIZATION_PLUGIN.executors![0],
              FIXTURE_SECT_ORGANIZATION_PLUGIN.executors![0],
            ],
          },
        ],
      }),
    ).toThrow('宗门任务执行器重复注册');
  });

  it('standard organization needs no empty sect-specific server plugin', () => {
    expect(() =>
      composeSectOrganizationPlugins({
        organizations: [{
          sectId: 'fixture-sect',
          organization: new StandardSectOrganizationModule(),
        }],
        manifests: [CORE_SECT_ORGANIZATION_PLUGIN],
      }),
    ).not.toThrow();
  });

  it('fails fast when a plugin does not contribute its declared executor', () => {
    expect(() =>
      composeSectOrganizationPlugins({
        organizations: [{
          sectId: 'fixture-sect',
          organization: FIXTURE_SECT_MODULE.organization,
        }],
        manifests: [
          CORE_SECT_ORGANIZATION_PLUGIN,
          { ...FIXTURE_SECT_ORGANIZATION_PLUGIN, executors: [] },
        ],
      }),
    ).toThrow('任务 fixture_patrol 缺少执行器：fixture-sect.battle');
  });

  it('rejects duplicate sect plugin manifests', () => {
    expect(() =>
      composeSectOrganizationPlugins({
        organizations: [{
          sectId: 'fixture-sect',
          organization: FIXTURE_SECT_MODULE.organization,
        }],
        manifests: [
          CORE_SECT_ORGANIZATION_PLUGIN,
          FIXTURE_SECT_ORGANIZATION_PLUGIN,
          FIXTURE_SECT_ORGANIZATION_PLUGIN,
        ],
      }),
    ).toThrow('宗门服务端插件重复注册：fixture-sect');
  });

  it('rejects a sect plugin without a registered content module', () => {
    expect(() =>
      composeSectOrganizationPlugins({
        organizations: [
          {
            sectId: 'fixture-sect',
            organization: FIXTURE_SECT_MODULE.organization,
          },
        ],
        manifests: [
          CORE_SECT_ORGANIZATION_PLUGIN,
          { sectId: 'missing-sect' },
        ],
      }),
    ).toThrow('宗门服务端插件没有对应内容模块：missing-sect');
  });

  it('rejects contribution keys outside their plugin namespace', () => {
    const createExecutor = FIXTURE_SECT_ORGANIZATION_PLUGIN.executors![0];
    expect(() =>
      composeSectOrganizationPlugins({
        organizations: [{
          sectId: 'fixture-sect',
          organization: FIXTURE_SECT_MODULE.organization,
        }],
        manifests: [
          CORE_SECT_ORGANIZATION_PLUGIN,
          {
            ...FIXTURE_SECT_ORGANIZATION_PLUGIN,
            executors: [() => ({ ...createExecutor(), key: 'foreign.battle' })],
          },
        ],
      }),
    ).toThrow('必须使用 fixture-sect. 命名空间');
  });

  it('requires every declared economy kind to have a registered strategy', () => {
    const organization: SectOrganizationModule = {
      ...FIXTURE_SECT_MODULE.organization,
      economy: {
        ...FIXTURE_SECT_MODULE.organization.economy,
        rewardGrantKinds: [
          ...FIXTURE_SECT_MODULE.organization.economy.rewardGrantKinds,
          'fixture-sect.missing-reward',
        ],
        donationKinds: [
          ...FIXTURE_SECT_MODULE.organization.economy.donationKinds,
          'fixture-sect.missing-donation',
        ],
      },
    };
    expect(() =>
      composeSectOrganizationPlugins({
        organizations: [{ sectId: 'fixture-sect', organization }],
        manifests: [
          CORE_SECT_ORGANIZATION_PLUGIN,
          FIXTURE_SECT_ORGANIZATION_PLUGIN,
        ],
      }),
    ).toThrow('缺少奖励策略：fixture-sect.missing-reward');
    const donationOnly: SectOrganizationModule = {
      ...organization,
      economy: {
        ...organization.economy,
        rewardGrantKinds: FIXTURE_SECT_MODULE.organization.economy.rewardGrantKinds,
      },
    };
    expect(() =>
      composeSectOrganizationPlugins({
        organizations: [{ sectId: 'fixture-sect', organization: donationOnly }],
        manifests: [
          CORE_SECT_ORGANIZATION_PLUGIN,
          FIXTURE_SECT_ORGANIZATION_PLUGIN,
        ],
      }),
    ).toThrow('缺少捐献策略：fixture-sect.missing-donation');
  });

  it('rejects an availability policy that emits an undeclared executor', async () => {
    const task = {
      ...FIXTURE_SECT_MODULE.organization.tasks.listDaily()[0]!,
      availability: {
        executorKeys: ['fixture-sect.battle'],
        resolve: () => ({ executorKey: 'fixture-sect.dynamic-unknown' }),
      },
    };
    const organization: SectOrganizationModule = {
      ...FIXTURE_SECT_MODULE.organization,
      tasks: {
        ...FIXTURE_SECT_MODULE.organization.tasks,
        listDaily: () => [task],
        get: (id) => id === task.id ? task : undefined,
      },
    };
    const { context } = fixtureContext(organization);
    const plugins = composeSectOrganizationPlugins({
      organizations: [{ sectId: 'fixture-sect', organization }],
      manifests: [
        CORE_SECT_ORGANIZATION_PLUGIN,
        FIXTURE_SECT_ORGANIZATION_PLUGIN,
      ],
    });
    await expect(
      new GetSectTasksQueryHandler(plugins.executors, plugins.progress)
        .execute('cultivator-1', context),
    ).rejects.toThrow('返回未声明的执行器：fixture-sect.dynamic-unknown');
  });
});
