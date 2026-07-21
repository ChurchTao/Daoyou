import type { DbTransaction } from '@server/lib/drizzle/db';
import type { SectRepositoryPort } from '@server/lib/repositories/sectRepository';
import { createSectTestApplication } from '@server/lib/services/sect-organization/testing/createSectTestApplication';
import { AbilityType } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type { Cultivator } from '@shared/types/cultivator';
import { describe, expect, it, vi } from 'vitest';
import { productionSectRuntime } from '../content';
import { createProductionSectCatalog } from '../content/productionRuntime';
import type {
  SectBuildBuilder,
  SectModule,
  SectPathCompileContext,
  SectPathDefinitionWithoutNodes,
} from '../core';
import {
  BaseSectPathModule,
  ConfiguredSectNodePlugin,
  SectAbilityFactory,
  StandardSectRules,
  createSectRuntime,
} from '../core';
import {
  FIXTURE_SECT_MODULE,
  fixtureSectState,
} from './fixtures/FixtureSectModule';

const cultivator = {
  id: 'fixture-cultivator',
  name: '样例弟子',
  playerRace: 'human',
  realm: '筑基',
  realm_stage: '初期',
} as Cultivator;

describe('第二宗门扩展闭环', () => {
  it('从效果和职责投影物理、法术、真实、范围、治疗、控制、utility 与被动标签', () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    const details = new Map(
      runtime
        .resolveAbilities({ sect: fixtureSectState(), realm: '筑基' })
        .map((ability) => [ability.id, ability]),
    );

    expect(details.get('fixture-ability-1')?.config.tags).toEqual(
      expect.arrayContaining([
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.PHYSICAL,
        GameplayTags.ABILITY.TARGET.SINGLE,
      ]),
    );
    expect(details.get('fixture-ability-2')?.config.tags).toEqual(
      expect.arrayContaining([
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.MAGIC,
        GameplayTags.ABILITY.TARGET.AOE,
      ]),
    );
    expect(details.get('fixture-ability-3')?.config.tags).toContain(
      GameplayTags.ABILITY.FUNCTION.HEAL,
    );
    expect(
      details.get('fixture-ability-3')?.config.selectionProfile?.intents,
    ).toContain('heal_hp');
    expect(details.get('fixture-ability-4')?.config.tags).toEqual(
      expect.arrayContaining([
        GameplayTags.ABILITY.FUNCTION.CONTROL,
        GameplayTags.ABILITY.SECT.UTILITY,
      ]),
    );
    expect(
      details.get('fixture-ability-4')?.config.selectionProfile?.intents,
    ).toContain('control');
    expect(details.get('fixture-ability-5')?.config.tags).toContain(
      GameplayTags.ABILITY.CHANNEL.TRUE,
    );
    expect(details.get('fixture-ability-6')?.config).toMatchObject({
      type: AbilityType.PASSIVE_SKILL,
    });
  });

  it('显式 AI 意图优先，无法推导时要求作者声明', () => {
    const definition = FIXTURE_SECT_MODULE.definition.abilities.find(
      (ability) =>
        ability.id === 'fixture-ability-2' && ability.kind === 'active',
    );
    if (!definition || definition.kind !== 'active')
      throw new Error('测试能力缺失');
    const factory = new SectAbilityFactory('fixture-sect');
    const override = factory.active({
      definition,
      targetPolicy: { team: 'self', scope: 'single' },
      selectionProfile: { intents: ['defensive'] },
      effects: [],
    });
    expect(override.config.selectionProfile?.intents).toEqual(['defensive']);
    expect(() =>
      factory.active({
        definition,
        targetPolicy: { team: 'self', scope: 'single' },
        effects: [],
      }),
    ).toThrow('必须显式声明 selectionProfile');
  });

  it('未解锁默认能力不能进入战斗投影', () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    const state = fixtureSectState();
    state.methods['fixture-method-1'] = 0;
    expect(() => runtime.projectCombat({ sect: state, realm: '筑基' })).toThrow(
      '没有已解锁的默认能力',
    );
  });

  it('单一生产目录项同时提供领域模块和完整展示主题', () => {
    const catalog = createProductionSectCatalog([
      {
        module: FIXTURE_SECT_MODULE,
        presentation: {
          sectId: 'fixture-sect',
          scenes: { arena: { title: '星轨演法台' } },
        },
      },
    ]);
    expect(catalog).toHaveLength(1);
    expect(catalog[0].module.definition.id).toBe('fixture-sect');
    expect(catalog[0].presentation?.scenes?.arena?.title).toBe('星轨演法台');
    expect(() =>
      createProductionSectCatalog([
        { module: FIXTURE_SECT_MODULE },
        { module: FIXTURE_SECT_MODULE },
      ]),
    ).toThrow('重复宗门 ID');
    expect(() =>
      createProductionSectCatalog([
        {
          module: FIXTURE_SECT_MODULE,
          presentation: { sectId: 'another-sect' },
        },
      ]),
    ).toThrow('标识不一致');
  });

  it('批量解析全部神通只编译一次', () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    const compile = vi.spyOn(runtime.compiler, 'compile');

    expect(
      runtime.resolveAbilities({ sect: fixtureSectState(), realm: '筑基' }),
    ).toHaveLength(6);
    expect(compile).toHaveBeenCalledTimes(1);
  });

  it('新增第三个测试流派只需实现流派模块并加入所属宗门组合表', () => {
    const definition: SectPathDefinitionWithoutNodes = {
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
    };
    class ThirdPathModule extends BaseSectPathModule {
      constructor() {
        super(
          definition,
          FIXTURE_SECT_MODULE.definition.paths[0].nodes.map(
            (node) =>
              new ConfiguredSectNodePlugin(
                {
                  ...node,
                  id: node.id.replace('fixture-first', 'fixture-third'),
                },
                (context, builder) => {
                  builder.updateResource('fixture.resource', (resource) => ({
                    ...resource,
                    initial: context.activeNodeIds.size,
                  }));
                },
              ),
          ),
        );
      }
      protected initializeBuild(
        _context: SectPathCompileContext,
        builder: SectBuildBuilder,
      ): void {
        builder.clearResources().setResource({
          id: 'fixture.resource',
          name: '专注',
          initial: 0,
          max: 18,
        });
      }
      createSelectionStrategy() {
        return { select: () => null };
      }
    }
    const thirdPath = new ThirdPathModule();
    const module: SectModule = {
      definition: {
        ...FIXTURE_SECT_MODULE.definition,
        paths: [...FIXTURE_SECT_MODULE.definition.paths, thirdPath.definition],
      },
      paths: new Map([
        ...FIXTURE_SECT_MODULE.paths,
        [thirdPath.definition.id, thirdPath],
      ]),
      progression: FIXTURE_SECT_MODULE.progression,
      methodGrowth: FIXTURE_SECT_MODULE.methodGrowth,
      organization: FIXTURE_SECT_MODULE.organization,
      createBaseBuilder: (context) =>
        FIXTURE_SECT_MODULE.createBaseBuilder(context),
      checkAdmission: (context) => FIXTURE_SECT_MODULE.checkAdmission(context),
    };
    const runtime = createSectRuntime([module]);

    expect(
      runtime.registry.require('fixture-sect').paths.get('fixture-third-path'),
    ).toBe(thirdPath);
  });

  it('隔离运行时支持两个流派且不会进入生产目录', () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    expect(
      runtime.registry.require('fixture-sect').definition.paths,
    ).toHaveLength(2);
    expect(productionSectRuntime.registry.get('fixture-sect')).toBeUndefined();
    expect(FIXTURE_SECT_MODULE.organization.tasks.listDaily()).not.toHaveLength(
      0,
    );
    expect(
      FIXTURE_SECT_MODULE.organization.economy.shopItems('any'),
    ).not.toHaveLength(0);
    expect(
      FIXTURE_SECT_MODULE.organization.construction.facilityPriority,
    ).not.toHaveLength(0);

    const state = fixtureSectState();
    state.activePathId = 'fixture-second-path';
    state.paths = [
      {
        pathId: 'fixture-second-path',
        unlockedLayerIds: ['foundation'],
        tacticId: 'fixture-second-tactic',
        activeMeridianSlot: 1,
        meridianLoadouts: [
          {
            slot: 1,
            nodeIds: ['fixture-second-foundation-1'],
            version: 1,
          },
          { slot: 2, nodeIds: [], version: 1 },
          { slot: 3, nodeIds: [], version: 1 },
        ],
      },
    ];
    const projection = runtime.projectCombat({ sect: state, realm: '筑基' });
    expect(projection?.resources[0]).toMatchObject({
      id: 'fixture.resource',
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
        unlockedLayerIds: ['foundation'],
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
      loadCultivatorProgress: vi.fn(async () => ({
        realm: '筑基',
        stage: '初期',
        stones: 0,
        cultivationExp: 0,
        comprehensionInsight: 0,
        playerRace: 'human',
      })),
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
    const service = createSectTestApplication({ runtime, repository });

    expect(
      service.listAvailableDefinitions({
        playerRace: 'human',
        realm: '筑基',
        stage: '初期',
      })[0].id,
    ).toBe('fixture-sect');
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

  it('内存Repository可完成直接入宗、成长、双流派和参悟闭环', async () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    let state: ReturnType<typeof fixtureSectState> | undefined;
    let stones = 100_000;
    let cultivationExp = 100_000;
    let comprehensionInsight = 100;
    const membership = () =>
      state
        ? {
            id: state.membershipId,
            sectId: state.sectId,
            status: state.status,
          }
        : null;
    const repository = {
      loadCultivatorProgress: vi.fn(async () => ({
        realm: '筑基',
        stage: '中期',
        stones,
        cultivationExp,
        comprehensionInsight,
        playerRace: 'human',
      })),
      spendTrainingResources: vi.fn(async (_cultivatorId, cost) => {
        if (
          stones < cost.spiritStones ||
          cultivationExp < cost.cultivationExp ||
          comprehensionInsight < cost.comprehensionInsight
        )
          return false;
        stones -= cost.spiritStones;
        cultivationExp -= cost.cultivationExp;
        comprehensionInsight -= cost.comprehensionInsight;
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
      ensureMembershipCandidate: vi.fn(async () => {
        state = {
          ...fixtureSectState(),
          status: 'prospect',
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
      createPathWithFirstLayer: vi.fn(
        async (_membershipId, pathId, tacticId, layerId) => {
          if (state!.paths.some((path) => path.pathId === pathId)) return false;
          state!.paths.push({
            pathId,
            unlockedLayerIds: [layerId],
            tacticId,
            activeMeridianSlot: 1,
            meridianLoadouts: [1, 2, 3].map((slot) => ({
              slot: slot as 1 | 2 | 3,
              nodeIds: [],
              version: 1,
            })),
          });
          return true;
        },
      ),
      appendUnlockedPathLayer: vi.fn(async (_membershipId, pathId, layerId) => {
        state!.paths
          .find((path) => path.pathId === pathId)!
          .unlockedLayerIds.push(layerId);
        return true;
      }),
      activatePathIfNone: vi.fn(async (_membershipId, pathId) => {
        state!.activePathId ??= pathId;
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
    const service = createSectTestApplication({ runtime, repository });
    const tx = {} as DbTransaction;

    await service.join(cultivator.id!, 'fixture-sect', tx);
    await service.trainMethod(
      {
        cultivatorId: cultivator.id!,
        methodId: 'fixture-method-1',
        targetLevel: 2,
      },
      tx,
    );
    await service.trainMethod(
      {
        cultivatorId: cultivator.id!,
        methodId: 'fixture-method-2',
        targetLevel: 2,
      },
      tx,
    );
    await service.unlockPathLayer(
      {
        cultivatorId: cultivator.id!,
        pathId: 'fixture-first-path',
        layerId: 'foundation',
      },
      tx,
    );
    await service.setMeridianLoadout(
      cultivator.id!,
      'fixture-first-path',
      1,
      ['fixture-first-foundation-1'],
      tx,
    );
    const sevenLayerPath = FIXTURE_SECT_MODULE.definition.paths.find(
      (path) => path.id === 'fixture-first-path',
    )!;
    for (const layer of sevenLayerPath.layers.slice(1)) {
      await service.unlockPathLayer(
        {
          cultivatorId: cultivator.id!,
          pathId: sevenLayerPath.id,
          layerId: layer.id,
        },
        tx,
      );
    }
    const sevenLayerNodes = sevenLayerPath.layers.map(
      (layer) =>
        sevenLayerPath.nodes.find((node) => node.layerId === layer.id)!.id,
    );
    await service.setMeridianLoadout(
      cultivator.id!,
      sevenLayerPath.id,
      1,
      sevenLayerNodes,
      tx,
    );
    await service.unlockPathLayer(
      {
        cultivatorId: cultivator.id!,
        pathId: 'fixture-second-path',
        layerId: 'foundation',
      },
      tx,
    );
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
    expect(state?.paths[0].unlockedLayerIds).toHaveLength(7);
    expect(state?.paths[0].meridianLoadouts[0].nodeIds).toEqual(
      sevenLayerNodes,
    );
    expect(
      runtime.projectCombat({ sect: state!, realm: '筑基' })?.resources[0].id,
    ).toBe('fixture.resource');
  });

  it('直接入宗时仍执行模块准入策略', async () => {
    const rejectedModule: SectModule = {
      definition: FIXTURE_SECT_MODULE.definition,
      paths: FIXTURE_SECT_MODULE.paths,
      progression: FIXTURE_SECT_MODULE.progression,
      methodGrowth: FIXTURE_SECT_MODULE.methodGrowth,
      organization: FIXTURE_SECT_MODULE.organization,
      createBaseBuilder: (context) =>
        FIXTURE_SECT_MODULE.createBaseBuilder(context),
      checkAdmission: () => ({ allowed: false, reason: '样例拒绝原因' }),
    };
    const runtime = createSectRuntime([rejectedModule]);
    const service = createSectTestApplication({
      runtime,
      repository: {
        loadCultivatorProgress: vi.fn(async () => ({
          realm: '炼气',
          stage: '初期',
          stones: 0,
          cultivationExp: 0,
          comprehensionInsight: 0,
          playerRace: 'human',
        })),
      } as unknown as SectRepositoryPort,
    });
    await expect(
      service.join('fixture-cultivator', 'fixture-sect', {} as DbTransaction),
    ).rejects.toThrow('样例拒绝原因');
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
        unlockedLayerIds: ['foundation'],
        tacticId: 'fixture-first-tactic',
        activeMeridianSlot: 1,
        meridianLoadouts: [
          {
            slot: 1,
            nodeIds: [
              'fixture-first-foundation-1',
              'fixture-first-foundation-2',
            ],
            version: 1,
          },
          { slot: 2, nodeIds: [], version: 1 },
          { slot: 3, nodeIds: [], version: 1 },
        ],
      },
    ];
    expect(() => runtime.validateState(meridian)).toThrow('只能选择一个节点');
  });

  it('七层流派可保存完整参悟方案并进入战斗投影', () => {
    const runtime = createSectRuntime([FIXTURE_SECT_MODULE]);
    const state = fixtureSectState();
    const path = FIXTURE_SECT_MODULE.definition.paths[0];
    expect(path.layers).toHaveLength(7);
    state.activePathId = path.id;
    state.paths = [
      {
        pathId: path.id,
        unlockedLayerIds: path.layers.map((layer) => layer.id),
        tacticId: path.defaultTacticId,
        activeMeridianSlot: StandardSectRules.meridianLoadoutSlots[0],
        meridianLoadouts: StandardSectRules.meridianLoadoutSlots.map(
          (slot) => ({
            slot,
            nodeIds:
              slot === StandardSectRules.meridianLoadoutSlots[0]
                ? path.layers.map(
                    (layer) =>
                      path.nodes.find((node) => node.layerId === layer.id)!.id,
                  )
                : [],
            version: 1,
          }),
        ),
      },
    ];
    expect(() => runtime.validateState(state)).not.toThrow();
    expect(
      runtime.projectCombat({ sect: state, realm: '筑基' }),
    ).not.toBeNull();
  });
});
