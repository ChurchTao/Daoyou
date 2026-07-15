import type { DbTransaction } from '@server/lib/drizzle/db';
import type { SectRepositoryPort } from '@server/lib/repositories/sectRepository';
import type { CultivatorSectState } from '@shared/engine/sect';
import { createSectRuntime } from '@shared/engine/sect';
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

import { createSectService, SectService } from './SectService';

const tx = {} as DbTransaction;

function activeSect(): CultivatorSectState {
  return {
    membershipId: 'member-1',
    sectId: 'lingxiao',
    status: 'active',
    contribution: 0,
    configVersion: 3,
    paths: [],
    methods: { 'lingxiao-canon': 30, 'sword-guidance': 30, 'void-step': 30 },
    abilityLoadout: ['guiding-sword', 'linked-edge', 'turning-body', null],
  };
}

describe('SectService.setAbilityLoadout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSectMock.mockResolvedValue(activeSect());
  });

  it('accepts sparse fixed slots and preserves their positions', async () => {
    await expect(
      SectService.setAbilityLoadout(
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
        SectService.setAbilityLoadout('cultivator-1', slots, tx),
      ).rejects.toMatchObject({ code: 'SECT_INVALID_LOADOUT' });
      expect(replaceAbilityLoadoutMock).not.toHaveBeenCalled();
    },
  );
});

describe('SectService.unlockPathLayer', () => {
  function setupProgress(resources: {
    cultivationExp: number;
    comprehensionInsight: number;
    stones: number;
  }) {
    let state = fixtureSectState();
    const spendTrainingResources = vi.fn(async () => true);
    const repository = {
      loadCultivatorSectState: vi.fn(async () => state),
      loadCultivatorProgress: vi.fn(async () => ({
        realm: '筑基',
        stage: '初期',
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
      service: createSectService({
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
});
