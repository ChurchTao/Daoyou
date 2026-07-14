import type { DbTransaction } from '@server/lib/drizzle/db';
import type { SectRepositoryPort } from '@server/lib/repositories/sectRepository';
import { createSectService } from '@server/lib/services/SectService';
import type { Cultivator } from '@shared/types/cultivator';
import { describe, expect, it, vi } from 'vitest';
import { productionSectRuntime } from './catalog';
import { DeterministicSectPathModule } from './pathModule';
import { createSectRuntime } from './runtimeFactory';
import { FIXTURE_SECT_MODULE, fixtureSectState } from './testing/fixtureSect';
import type {
  CultivatorSectPathState,
  SectCompiledBuild,
  SectPathDefinition,
  SectProjectionContext,
} from './types';

const cultivator = {
  id: 'fixture-cultivator',
  name: '样例弟子',
  playerRace: 'human',
  realm: '筑基',
  realm_stage: '初期',
} as Cultivator;

describe('第二宗门扩展闭环', () => {
  it('新增第三个测试流派只需实现流派模块并加入所属宗门组合表', () => {
    const definition: SectPathDefinition = {
      ...FIXTURE_SECT_MODULE.definition.paths[0],
      id: 'fixture-third-path',
      name: '第三流派',
      defaultTacticId: 'fixture-third-tactic',
      tactics: [
        {
          id: 'fixture-third-tactic',
          name: '第三战术',
          description: '测试第三流派策略',
        },
      ],
      nodes: FIXTURE_SECT_MODULE.definition.paths[0].nodes.map((node) => ({
        ...node,
        id: node.id.replace('fixture-first', 'fixture-third'),
      })),
    };
    class ThirdPathModule extends DeterministicSectPathModule {
      constructor() {
        super(definition);
      }
      protected compilePath(
        context: SectProjectionContext & { path: CultivatorSectPathState },
        base: Readonly<SectCompiledBuild>,
        activeNodeIds: ReadonlySet<string>,
      ) {
        return {
          ...base,
          resources: [
            {
              id: 'fixture-third-resource',
              name: '第三资源',
              initial: activeNodeIds.size,
              max: 18,
            },
          ],
        };
      }
      createSelectionStrategy() {
        return { select: () => null };
      }
    }
    const thirdPath = new ThirdPathModule();
    const module = {
      ...FIXTURE_SECT_MODULE,
      definition: {
        ...FIXTURE_SECT_MODULE.definition,
        paths: [...FIXTURE_SECT_MODULE.definition.paths, definition],
      },
      paths: { ...FIXTURE_SECT_MODULE.paths, [definition.id]: thirdPath },
    };
    const runtime = createSectRuntime([module]);

    expect(
      runtime.registry.require('fixture-sect').paths['fixture-third-path'],
    ).toBe(thirdPath);
  });

  it('隔离运行时支持两个流派且不会进入生产目录', () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    expect(
      runtime.registry.require('fixture-sect').definition.paths,
    ).toHaveLength(2);
    expect(productionSectRuntime.registry.get('fixture-sect')).toBeUndefined();

    const state = fixtureSectState();
    state.activePathId = 'fixture-second-path';
    state.paths = [
      {
        pathId: 'fixture-second-path',
        level: 5,
        tacticId: 'fixture-second-tactic',
        activeMeridianSlot: 1,
        meridianLoadouts: [
          { slot: 1, nodeIds: ['fixture-second-1-1'], version: 1 },
          { slot: 2, nodeIds: [], version: 1 },
          { slot: 3, nodeIds: [], version: 1 },
        ],
      },
    ];
    const projection = runtime.projectCombat({ sect: state, realm: '筑基' });
    expect(projection?.resources[0]).toMatchObject({
      id: 'fixture-second-resource',
      initial: 1,
    });
    expect(projection?.selectionStrategy).toBeDefined();
  });

  it('同一运行时可注入Service完成目录、试炼、流派切换和四槽装配', async () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    let state = fixtureSectState();
    state.paths = [
      {
        pathId: 'fixture-first-path',
        level: 5,
        tacticId: 'fixture-first-tactic',
        activeMeridianSlot: 1,
        meridianLoadouts: [
          { slot: 1, nodeIds: [], version: 1 },
          { slot: 2, nodeIds: [], version: 1 },
          { slot: 3, nodeIds: [], version: 1 },
        ],
      },
    ];
    const repository = {
      loadCultivatorSectState: vi.fn(async () => state),
      listMemberships: vi.fn(async () => [
        { sectId: state.sectId, status: state.status },
      ]),
      replaceAbilityLoadout: vi.fn(async (_membershipId, slots) => {
        state = { ...state, abilityLoadout: slots };
      }),
      activatePath: vi.fn(async (_membershipId, pathId) => {
        state = { ...state, activePathId: pathId };
        return true;
      }),
    } as unknown as SectRepositoryPort;
    const service = createSectService({ runtime, repository });

    expect(
      service.listAvailableDefinitions({
        playerRace: 'human',
        realm: '筑基',
        stage: '初期',
      })[0].id,
    ).toBe('fixture-sect');
    expect(
      service.createTrialScenario('fixture-sect', cultivator).opponent.name,
    ).toBe('样例木人');
    await service.activatePath(
      'fixture-cultivator',
      'fixture-first-path',
      {} as DbTransaction,
    );
    await service.setAbilityLoadout(
      'fixture-cultivator',
      ['fixture-ability-2', null, null, null],
      {} as DbTransaction,
    );

    expect(state.activePathId).toBe('fixture-first-path');
    expect(state.abilityLoadout).toEqual([
      'fixture-ability-2',
      null,
      null,
      null,
    ]);
  });

  it('内存Repository可完成试炼记录、入宗、成长、双流派和经脉闭环', async () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    let state: ReturnType<typeof fixtureSectState> | undefined;
    let experiencedAt: Date | undefined;
    let stones = 100_000;
    const membership = () =>
      state
        ? {
            id: state.membershipId,
            sectId: state.sectId,
            status: state.status,
            experiencedAt,
          }
        : null;
    const repository = {
      loadCultivatorProgress: vi.fn(async () => ({
        realm: '筑基',
        stage: '初期',
        stones,
        playerRace: 'human',
      })),
      spendSpiritStones: vi.fn(async (_cultivatorId, amount) => {
        if (stones < amount) return false;
        stones -= amount;
        return true;
      }),
      findMembership: vi.fn(async () =>
        state?.status === 'active' ? membership() : null,
      ),
      findMembershipForSect: vi.fn(async () => membership()),
      listMemberships: vi.fn(async () => (membership() ? [membership()] : [])),
      loadCultivatorSectState: vi.fn(async () =>
        state?.status === 'active' ? state : undefined,
      ),
      loadCultivatorSectStateForSect: vi.fn(async () => state),
      recordExperience: vi.fn(async () => {
        experiencedAt = new Date();
        state = {
          ...fixtureSectState(),
          status: 'prospect',
          experiencedAt: experiencedAt.toISOString(),
          methods: {},
          abilityLoadout: [null, null, null, null],
        };
        return membership();
      }),
      activateMembership: vi.fn(async (_membershipId, definition) => {
        state = {
          ...state!,
          status: 'active',
          contribution: 100_000,
          methods: { ...definition.onboarding.initialMethods },
          abilityLoadout: [...definition.onboarding.initialAbilityLoadout],
        };
      }),
      setMethodLevel: vi.fn(async (_membershipId, methodId, level) => {
        state!.methods[methodId] = level;
      }),
      spendContribution: vi.fn(async (_membershipId, amount) => {
        if (state!.contribution < amount) return false;
        state!.contribution -= amount;
        return true;
      }),
      enrollPath: vi.fn(async (_membershipId, pathId, tacticId) => {
        if (state!.paths.some((path) => path.pathId === pathId)) return false;
        state!.paths.push({
          pathId,
          level: 0,
          tacticId,
          activeMeridianSlot: 1,
          meridianLoadouts: [1, 2, 3].map((slot) => ({
            slot: slot as 1 | 2 | 3,
            nodeIds: [],
            version: 1,
          })),
        });
        return true;
      }),
      setPathLevel: vi.fn(async (_membershipId, pathId, level) => {
        state!.paths.find((path) => path.pathId === pathId)!.level = level;
      }),
      activatePath: vi.fn(async (_membershipId, pathId) => {
        if (!state!.paths.some((path) => path.pathId === pathId)) return false;
        state!.activePathId = pathId;
        return true;
      }),
      replaceMeridianLoadout: vi.fn(
        async (_membershipId, pathId, slot, nodeIds) => {
          state!.paths
            .find((path) => path.pathId === pathId)!
            .meridianLoadouts.find(
              (loadout) => loadout.slot === slot,
            )!.nodeIds = nodeIds;
        },
      ),
      activateMeridianLoadout: vi.fn(async (_membershipId, pathId, slot) => {
        state!.paths.find(
          (path) => path.pathId === pathId,
        )!.activeMeridianSlot = slot;
      }),
      replaceAbilityLoadout: vi.fn(async (_membershipId, slots) => {
        state!.abilityLoadout = slots;
      }),
      setPathTactic: vi.fn(async (_membershipId, pathId, tacticId) => {
        state!.paths.find((path) => path.pathId === pathId)!.tacticId =
          tacticId;
      }),
    } as unknown as SectRepositoryPort;
    const service = createSectService({ runtime, repository });
    const tx = {} as DbTransaction;

    await service.recordExperience(cultivator.id!, 'fixture-sect', tx);
    await service.join(cultivator.id!, 'fixture-sect', tx);
    await service.trainMethod(
      {
        cultivatorId: cultivator.id!,
        methodId: 'fixture-method-2',
        targetLevel: 2,
      },
      tx,
    );
    await service.enrollPath(cultivator.id!, 'fixture-first-path', tx);
    await service.trainPath(
      {
        cultivatorId: cultivator.id!,
        pathId: 'fixture-first-path',
        targetLevel: 5,
      },
      tx,
    );
    await service.setMeridianLoadout(
      cultivator.id!,
      'fixture-first-path',
      1,
      ['fixture-first-1-1'],
      tx,
    );
    await service.enrollPath(cultivator.id!, 'fixture-second-path', tx);
    await service.activatePath(cultivator.id!, 'fixture-second-path', tx);
    await service.setPathTactic(
      cultivator.id!,
      'fixture-second-path',
      'fixture-second-tactic',
      tx,
    );
    await service.setAbilityLoadout(
      cultivator.id!,
      ['fixture-ability-2', null, null, null],
      tx,
    );

    expect(state).toMatchObject({
      status: 'active',
      activePathId: 'fixture-second-path',
    });
    expect(state?.paths).toHaveLength(2);
    expect(state?.paths[0].meridianLoadouts[0].nodeIds).toEqual([
      'fixture-first-1-1',
    ]);
    expect(
      runtime.projectCombat({ sect: state!, realm: '筑基' })?.resources[0].id,
    ).toBe('fixture-second-resource');
  });

  it('直接请求试炼时仍执行模块准入策略', () => {
    const runtime = createSectRuntime([
      {
        ...FIXTURE_SECT_MODULE,
        checkAdmission: () => ({ allowed: false, reason: '样例拒绝原因' }),
      },
    ]);
    const service = createSectService({
      runtime,
      repository: {} as SectRepositoryPort,
    });
    expect(() =>
      service.createTrialScenario('fixture-sect', cultivator),
    ).toThrow('样例拒绝原因');
  });

  it('拒绝重复装配和同层多节点的非法持久化状态', () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    const duplicate = fixtureSectState();
    duplicate.abilityLoadout = [
      'fixture-ability-2',
      'fixture-ability-2',
      null,
      null,
    ];
    expect(() => runtime.validateState(duplicate)).toThrow('不可重复装配');

    const meridian = fixtureSectState();
    meridian.activePathId = 'fixture-first-path';
    meridian.paths = [
      {
        pathId: 'fixture-first-path',
        level: 5,
        tacticId: 'fixture-first-tactic',
        activeMeridianSlot: 1,
        meridianLoadouts: [
          {
            slot: 1,
            nodeIds: ['fixture-first-1-1', 'fixture-first-1-2'],
            version: 1,
          },
          { slot: 2, nodeIds: [], version: 1 },
          { slot: 3, nodeIds: [], version: 1 },
        ],
      },
    ];
    expect(() => runtime.validateState(meridian)).toThrow('只能选择一个节点');
  });
});
