import type { DbTransaction } from '@server/lib/drizzle/db';
import type { SectRepositoryPort } from '@server/lib/repositories/sectRepository';
import type { CultivatorSectState, SectModule } from '@shared/engine/sect';
import {
  createSectRuntime,
  StandardSectCapabilityPolicy,
} from '@shared/engine/sect';
import {
  FIXTURE_SECT_MODULE,
  fixtureSectState,
} from '@shared/engine/sect/testing/fixtures/FixtureSectModule';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadSectMock, replaceAbilityLoadoutMock } = vi.hoisted(() => ({
  loadSectMock: vi.fn(),
  replaceAbilityLoadoutMock: vi.fn(),
}));

vi.mock('@server/lib/repositories/sectRepository', () => ({
  loadCultivatorSectState: loadSectMock,
  replaceAbilityLoadout: replaceAbilityLoadoutMock,
  postgresSectRepository: {
    loadCultivatorSectState: loadSectMock,
    replaceAbilityLoadout: replaceAbilityLoadoutMock,
  },
}));

import {
  createSectTestApplication,
} from './testing/createSectTestApplication';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { postgresSectRepository } from '@server/lib/repositories/sectRepository';
import { SectTraditionApplicationService } from './SectTraditionApplicationService';
import type {
  SectTraditionRepository,
  SectTrainingResourceGateway,
} from './ports';

const tx = {} as DbTransaction;
const traditionApplication = createSectTestApplication({
  runtime: productionSectRuntime,
  repository: postgresSectRepository,
});

function activeSect(): CultivatorSectState {
  return {
    membershipId: 'member-1',
    sectId: 'lingxiao',
    status: 'active',
    contribution: 0,
    configVersion: 4,
    paths: [],
    methods: { 'lingxiao-canon': 30, 'sword-guidance': 30, 'void-step': 30 },
    abilityLoadout: ['guiding-sword', 'linked-edge', 'turning-body', null],
  };
}

describe('SectTraditionApplicationService.setAbilityLoadout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSectMock.mockResolvedValue(activeSect());
  });

  it('accepts sparse fixed slots and preserves their positions', async () => {
    await expect(
      traditionApplication.setAbilityLoadout(
        'cultivator-1',
        ['guiding-sword', null, 'turning-body', null],
        tx,
      ),
    ).resolves.toMatchObject({ membershipId: 'member-1' });

    expect(replaceAbilityLoadoutMock).toHaveBeenCalledWith(
      'member-1',
      ['guiding-sword', null, 'turning-body', null],
      tx,
    );
  });

  it.each([
    [['guiding-sword', null, null]],
    [['guiding-sword', null, 'guiding-sword', null]],
    [['plain-sword', null, null, null]],
    [['breaking-edge', null, null, null]],
  ])(
    'rejects invalid, duplicate, default or locked slots: %j',
    async (slots) => {
      await expect(
        traditionApplication.setAbilityLoadout('cultivator-1', slots, tx),
      ).rejects.toMatchObject({ code: 'SECT_INVALID_LOADOUT' });
      expect(replaceAbilityLoadoutMock).not.toHaveBeenCalled();
    },
  );
});

describe('SectTraditionApplicationService.unlockPathLayer', () => {
  function setupProgress(resources: {
    cultivationExp: number;
    comprehensionInsight: number;
    stones: number;
    realm?: '炼气' | '筑基';
    stage?: '初期';
  }) {
    let state = fixtureSectState();
    const spendTrainingResources = vi.fn(async () => true);
    const repository = {
      loadCultivatorSectState: vi.fn(async () => state),
      loadCultivatorProgress: vi.fn(async () => ({
        realm: resources.realm ?? '筑基',
        stage: resources.stage ?? '初期',
        playerRace: 'human',
        ...resources,
      })),
      spendTrainingResources,
      createPathWithFirstLayer: vi.fn(
        async (_membershipId, pathId, tacticId, layerId) => {
          state = {
            ...state,
            paths: [
              {
                pathId,
                unlockedLayerIds: [layerId],
                tacticId,
                activeMeridianSlot: 1,
                meridianLoadouts: [1, 2, 3].map((slot) => ({
                  slot: slot as 1 | 2 | 3,
                  nodeIds: [],
                  version: 1,
                })),
              },
            ],
          };
          return true;
        },
      ),
      activatePathIfNone: vi.fn(async (_membershipId, pathId) => {
        state = { ...state, activePathId: pathId };
      }),
    } as unknown as SectRepositoryPort;
    return {
      service: createSectTestApplication({
        runtime: createSectRuntime([FIXTURE_SECT_MODULE]),
        repository,
      }),
      repository,
      spendTrainingResources,
      getState: () => state,
    };
  }

  it.each([
    [{ cultivationExp: 9, comprehensionInsight: 100, stones: 100 }, '修为不足'],
    [
      { cultivationExp: 100, comprehensionInsight: 0, stones: 100 },
      '道心感悟不足',
    ],
    [
      { cultivationExp: 100, comprehensionInsight: 100, stones: 19 },
      '灵石不足',
    ],
  ])(
    'rejects an insufficient resource independently',
    async (resources, message) => {
      const { service, spendTrainingResources } = setupProgress(resources);
      await expect(
        service.unlockPathLayer(
          {
            cultivatorId: 'fixture-cultivator',
            pathId: 'fixture-first-path',
            layerId: 'foundation',
          },
          tx,
        ),
      ).rejects.toThrow(message);
      expect(spendTrainingResources).not.toHaveBeenCalled();
    },
  );

  it('creates the first layer and activates it when no path is active', async () => {
    const { service, repository, getState } = setupProgress({
      cultivationExp: 100,
      comprehensionInsight: 100,
      stones: 100,
    });
    const result = await service.unlockPathLayer(
      {
        cultivatorId: 'fixture-cultivator',
        pathId: 'fixture-first-path',
        layerId: 'foundation',
      },
      tx,
    );

    expect(repository.createPathWithFirstLayer).toHaveBeenCalled();
    expect(repository.activatePathIfNone).toHaveBeenCalled();
    expect(result.cost).toEqual({
      cultivationExp: 10,
      comprehensionInsight: 1,
      spiritStones: 20,
    });
    expect(getState().activePathId).toBe('fixture-first-path');
  });

  it('rejects learning a path before 筑基初期 even with sufficient resources', async () => {
    const { service, spendTrainingResources } = setupProgress({
      cultivationExp: 100,
      comprehensionInsight: 100,
      stones: 100,
      realm: '炼气',
      stage: '初期',
    });
    await expect(
      service.unlockPathLayer(
        {
          cultivatorId: 'fixture-cultivator',
          pathId: 'fixture-first-path',
          layerId: 'foundation',
        },
        tx,
      ),
    ).rejects.toMatchObject({ code: 'SECT_REALM_GATE' });
    expect(spendTrainingResources).not.toHaveBeenCalled();
  });
});

describe('SectTraditionApplicationService capability boundary', () => {
  it('rejects archive, enlightenment and arena commands before spending or saving', async () => {
    const deniedOrganization = {
      ...FIXTURE_SECT_MODULE.organization,
      capabilities: new StandardSectCapabilityPolicy(
        Object.fromEntries(
          FIXTURE_SECT_MODULE.organization.capabilities
            .keys()
            .map((key) => [key, 'outer' as const]),
        ),
      ),
    };
    const deniedModule = new Proxy(FIXTURE_SECT_MODULE, {
      get(target, property, receiver) {
        if (property === 'organization') return deniedOrganization;
        return Reflect.get(target, property, receiver);
      },
    }) as SectModule;
    const state = fixtureSectState();
    const save = vi.fn(async () => undefined);
    const repository: SectTraditionRepository = {
      load: async () => state,
      loadForSect: async () => state,
      listMemberships: async () => [],
      setMethodLevel: save,
      createPathWithFirstLayer: async () => true,
      appendUnlockedPathLayer: async () => true,
      activatePathIfNone: save,
      activatePath: async () => true,
      replaceMeridianLoadout: save,
      activateMeridianLoadout: save,
      replaceAbilityLoadout: save,
      setPathTactic: save,
    };
    const spend = vi.fn(async () => true);
    const resources: SectTrainingResourceGateway = {
      load: async () => ({
        realm: '筑基',
        stage: '初期',
        playerRace: 'human',
        stones: 999,
        cultivationExp: 999,
        comprehensionInsight: 999,
      }),
      spend,
      methodLevelCap: async () => 100,
    };
    const service = new SectTraditionApplicationService(
      createSectRuntime([deniedModule]),
      repository,
      resources,
    );

    await expect(service.trainMethod({
      cultivatorId: 'fixture-cultivator',
      methodId: 'fixture-method-1',
      targetLevel: 2,
    })).rejects.toMatchObject({ status: 403 });
    await expect(service.unlockPathLayer({
      cultivatorId: 'fixture-cultivator',
      pathId: 'fixture-first-path',
      layerId: 'foundation',
    })).rejects.toMatchObject({ status: 403 });
    await expect(service.setAbilityLoadout(
      'fixture-cultivator',
      ['fixture-ability-2', null, null, null],
    )).rejects.toMatchObject({ status: 403 });
    expect(spend).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });
});
