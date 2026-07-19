import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getStateMock,
  getTodayMock,
  joinMock,
  unlockPathLayerMock,
  setAbilityLoadoutMock,
  listAvailableDefinitionsMock,
  taskActionMock,
} = vi.hoisted(() => ({
  getStateMock: vi.fn(),
  getTodayMock: vi.fn(),
  joinMock: vi.fn(),
  unlockPathLayerMock: vi.fn(),
  setAbilityLoadoutMock: vi.fn(),
  listAvailableDefinitionsMock: vi.fn(),
  taskActionMock: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({ getExecutor: vi.fn(() => ({})) }));
vi.mock('@server/lib/hono/middleware', () => {
  return {
    requireActiveCultivator:
      () => async (context: any, next: () => Promise<void>) => {
        context.set('user', { id: 'user-1' });
        context.set('cultivator', {
          id: 'cultivator-1',
          realm: '筑基',
          realm_stage: '初期',
          playerRace: 'human',
        });
        await next();
      },
    validateJson: () => async (context: any, next: () => Promise<void>) => {
      context.set('validatedJson', await context.req.json());
      await next();
    },
    getValidatedJson: (context: any) => context.get('validatedJson'),
    validateQuery: () => async (_context: any, next: () => Promise<void>) => {
      await next();
    },
    getValidatedQuery: () => ({ page: 1, pageSize: 20 }),
  };
});
vi.mock('@server/lib/services/sect-organization', () => ({
  sectOrganizationFacade: {
    admission: vi.fn(() => ({
      getState: getStateMock,
      getStateForSect: vi.fn(),
      listDefinitions: vi.fn(() => []),
      listAvailableDefinitions: listAvailableDefinitionsMock,
      listMemberships: vi.fn(() => []),
      createTrialScenario: vi.fn(),
      join: joinMock,
      recordExperience: vi.fn(),
    })),
    tradition: vi.fn(() => ({
      getState: getStateMock,
      getStateForSect: vi.fn(),
      trainMethod: vi.fn(),
      unlockPathLayer: unlockPathLayerMock,
      activatePath: vi.fn(),
      setMeridianLoadout: vi.fn(),
      activateMeridianLoadout: vi.fn(),
      setAbilityLoadout: setAbilityLoadoutMock,
      setPathTactic: vi.fn(),
    })),
    membership: {
    getOverview: vi.fn(async () => ({
      facilities: [],
      project: null,
      methodLevelCap: 20,
      realmMethodLevelCap: 25,
      stipend: {
        weekKey: '2026-07-13',
        claimed: false,
        spiritStones: 500,
        rewards: [
          {
            kind: 'material',
            name: '宗门灵草',
            quantity: 1,
            summary: '宗门灵草 ×1',
          },
        ],
      },
      nextRank: 'outer',
      promotionMissing: [],
    })),
    listMembers: vi.fn(),
    promote: vi.fn(),
    },
    tasks: {
      queries: { execute: vi.fn() },
      actions: { execute: taskActionMock },
    },
    economy: {
    getShop: vi.fn(),
    purchaseShopItem: vi.fn(),
    claimStipend: vi.fn(),
    },
    construction: {
    getConstruction: vi.fn(),
    donate: vi.fn(),
    },
  },
}));
vi.mock('@server/lib/services/SectCommissionService', () => ({
  SectCommissionService: {
    getToday: getTodayMock,
    recordEvent: vi.fn(),
    claim: vi.fn(),
  },
}));
vi.mock('@server/lib/services/cultivatorService', () => ({
  getPlayerRuntimeCultivatorById: vi.fn(),
}));
vi.mock('@shared/lib/battle/simulateBattleV5', () => ({
  simulateBattleV5: vi.fn(),
}));
vi.mock('@server/lib/services/PlayerStateMutationService', () => ({
  PlayerStateIdempotencyError: class PlayerStateIdempotencyError extends Error {},
  commitPlayerStateMutation: vi.fn(async (args) => {
    const value = await args.run({});
    return {
      result: value.result,
      state: {
        cultivatorId: 'cultivator-1',
        globalVersion: 1,
        domainVersions: { sect: 1 },
        events: [],
      },
    };
  }),
  toPlayerStateMutationResponse: vi.fn((value) => ({
    success: true,
    data: value.result,
    state: value.state,
  })),
}));

import sectsRouter, { createSectsRouter } from './sects.router';

const activeSect = {
  membershipId: 'm1',
  sectId: 'lingxiao',
  status: 'active',
  contribution: 30,
  configVersion: 4,
  activePathId: 'swift-sword',
  methods: { 'lingxiao-canon': 5, 'sword-guidance': 5 },
  paths: [
    {
      pathId: 'swift-sword',
      unlockedLayerIds: ['1'],
      tacticId: 'aggressive',
      activeMeridianSlot: 1,
      meridianLoadouts: [{ slot: 1, nodeIds: [], version: 1 }],
    },
  ],
  abilityLoadout: ['guiding-sword', null, null, null],
};

describe('sects router', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns current race, membership and organization overview', async () => {
    getStateMock.mockResolvedValue(activeSect);
    getTodayMock.mockResolvedValue({ dateKey: '2026-07-13' });
    const response = await new Hono()
      .route('/api/sects', sectsRouter)
      .request('/api/sects/current');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        playerRace: 'human',
        methodLevelCap: 20,
        sect: { status: 'active' },
        overview: { nextRank: 'outer' },
      },
    });
  });

  it('catalog delegates admission filtering to the injected sect service', async () => {
    listAvailableDefinitionsMock.mockReturnValue([]);
    const response = await new Hono()
      .route('/api/sects', sectsRouter)
      .request('/api/sects/catalog');
    expect(response.status).toBe(200);
    expect(listAvailableDefinitionsMock).toHaveBeenCalledWith({
      playerRace: 'human',
      realm: '筑基',
      stage: '初期',
    });
  });

  it('路由工厂使用注入的事务服务工厂而非生产单例', async () => {
    const admission = {
      listMemberships: vi.fn(async () => []),
      listAvailableDefinitions: vi.fn(() => []),
    };
    const injected = {
      admission: vi.fn(() => admission),
      tradition: vi.fn(),
    };
    const router = createSectsRouter({
      organizationFacade: injected as never,
    });
    const response = await new Hono()
      .route('/api/sects', router)
      .request('/api/sects/catalog');

    expect(response.status).toBe(200);
    expect(admission.listMemberships).toHaveBeenCalledWith('cultivator-1');
    expect(admission.listAvailableDefinitions).toHaveBeenCalledWith({
      playerRace: 'human',
      realm: '筑基',
      stage: '初期',
    });
  });

  it('commits joining as sect and loadout state changes', async () => {
    joinMock.mockResolvedValue(activeSect);
    const response = await new Hono()
      .route('/api/sects', sectsRouter)
      .request('/api/sects/lingxiao/join', {
        method: 'POST',
        headers: { 'Idempotency-Key': '00000000-0000-4000-8000-000000000001' },
      });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { sect: { membershipId: 'm1' } },
      state: { domainVersions: { sect: 1 } },
    });
  });

  it('passes four fixed nullable ability slots to the service', async () => {
    const slots = ['guiding-sword', null, 'turning-body', null];
    setAbilityLoadoutMock.mockResolvedValue({
      ...activeSect,
      abilityLoadout: slots,
    });

    const response = await new Hono()
      .route('/api/sects', sectsRouter)
      .request('/api/sects/current/ability-loadout', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': '00000000-0000-4000-8000-000000000002',
        },
        body: JSON.stringify({ abilityIds: slots }),
      });

    expect(response.status).toBe(200);
    expect(setAbilityLoadoutMock).toHaveBeenCalledWith('cultivator-1', slots);
  });

  it('passes the requested path layer to the generic unlock service', async () => {
    unlockPathLayerMock.mockResolvedValue({
      sect: activeSect,
      pathId: 'swift-sword',
      layerId: '2',
      cost: {
        cultivationExp: 2500,
        comprehensionInsight: 15,
        spiritStones: 25000,
      },
    });
    const response = await new Hono()
      .route('/api/sects', sectsRouter)
      .request('/api/sects/current/paths/swift-sword/layers/2/unlock', {
        method: 'POST',
        headers: { 'Idempotency-Key': '00000000-0000-4000-8000-000000000003' },
      });

    expect(response.status).toBe(200);
    expect(unlockPathLayerMock).toHaveBeenCalledWith(
      {
        cultivatorId: 'cultivator-1',
        pathId: 'swift-sword',
        layerId: '2',
      },
    );
  });

  it('requires an idempotency key on every sect write', async () => {
    joinMock.mockResolvedValue(activeSect);
    const response = await new Hono()
      .route('/api/sects', sectsRouter)
      .request('/api/sects/lingxiao/join', { method: 'POST' });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: '缺少有效的 Idempotency-Key 请求头',
    });
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('dispatches arbitrary registered task actions through the generic endpoint', async () => {
    taskActionMock.mockResolvedValue({
      task: { definitionId: 'fixture-task', state: 'completed' },
      outcome: { renderer: 'fixture.outcome', data: { ok: true } },
    });
    const response = await new Hono()
      .route('/api/sects', sectsRouter)
      .request('/api/sects/current/tasks/fixture-task/actions/finish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': '00000000-0000-4000-8000-000000000004',
        },
        body: JSON.stringify({ input: { value: 1 } }),
      });
    expect(response.status).toBe(200);
    expect(taskActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'fixture-task',
        actionKey: 'finish',
        input: { value: 1 },
      }),
      expect.anything(),
    );
  });

  it('returns 400 for an unregistered sect id', async () => {
    const response = await new Hono()
      .route('/api/sects', sectsRouter)
      .request('/api/sects/not-registered');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: 'SECT_UNKNOWN',
    });
  });

  it('does not expose removed Lingxiao-specific endpoints', async () => {
    const app = new Hono().route('/api/sects', sectsRouter);

    expect(
      (await app.request('/api/sects/lingxiao/experience', { method: 'POST' }))
        .status,
    ).toBe(404);
    expect(
      (
        await app.request('/api/sects/paths/swift-sword/select', {
          method: 'POST',
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request('/api/sects/current/paths/swift-sword/enroll', {
          method: 'POST',
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await app.request('/api/sects/current/paths/swift-sword/train', {
          method: 'POST',
        })
      ).status,
    ).toBe(404);
    for (const path of [
      '/api/sects/current/tasks/daily/accept',
      '/api/sects/current/tasks/gate_sweep/start',
      '/api/sects/current/tasks/gate_sweep/complete',
      '/api/sects/current/tasks/fixture-task/challenge',
    ])
      expect((await app.request(path, { method: 'POST' })).status).toBe(404);
  });
});
