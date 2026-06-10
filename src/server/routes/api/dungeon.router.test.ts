import { Hono } from 'hono';

const {
  startDungeonMock,
  handleActionMock,
  quitDungeonMock,
  probeBattleEnemyMock,
  abandonBattleMock,
  executeBattleMock,
  continueFromLootingMock,
  escapeFromLootingMock,
  recoverDungeonMock,
  listCultivatorTasksMock,
  getCultivatorByIdUnsafeMock,
  getCultivatorDisplaySnapshotMock,
  getMapNodeMock,
  isSatelliteNodeMock,
  DungeonFlowErrorMock,
  QiInsufficientErrorMock,
  QiServiceErrorMock,
  commitPlayerStateMutationMock,
} = vi.hoisted(() => ({
  startDungeonMock: vi.fn(),
  handleActionMock: vi.fn(),
  quitDungeonMock: vi.fn(),
  probeBattleEnemyMock: vi.fn(),
  abandonBattleMock: vi.fn(),
  executeBattleMock: vi.fn(),
  continueFromLootingMock: vi.fn(),
  escapeFromLootingMock: vi.fn(),
  recoverDungeonMock: vi.fn(),
  listCultivatorTasksMock: vi.fn(),
  getCultivatorByIdUnsafeMock: vi.fn(),
  getCultivatorDisplaySnapshotMock: vi.fn(),
  getMapNodeMock: vi.fn(),
  isSatelliteNodeMock: vi.fn(),
  DungeonFlowErrorMock: class DungeonFlowError extends Error {
    code: string;
    status: 404 | 409;

    constructor(code: string, message: string, status: 404 | 409) {
      super(message);
      this.name = 'DungeonFlowError';
      this.code = code;
      this.status = status;
    }
  },
  QiInsufficientErrorMock: class QiInsufficientError extends Error {
    code = 'QI_INSUFFICIENT';
    action: string;
    required: number;
    current: number;

    constructor(args: { action: string; required: number; current: number }) {
      super('天地灵气不足');
      this.action = args.action;
      this.required = args.required;
      this.current = args.current;
    }
  },
  QiServiceErrorMock: class QiServiceError extends Error {
    status: number;

    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  commitPlayerStateMutationMock: vi.fn(async (input: any) => {
    const { result, changes } = await input.run({ __tx: true });
    return {
      result,
      state: {
        cultivatorId: input.cultivatorId,
        globalVersion: 20,
        domainVersions: Object.fromEntries(
          changes.map((change: any) => [change.domain, 20]),
        ),
        events: changes.map((change: any, index: number) => ({
          id: index + 1,
          cultivatorId: input.cultivatorId,
          globalVersion: 20,
          domain: change.domain,
          eventType: change.eventType,
          patch: change.patch ?? {},
          invalidates: change.invalidates ?? [],
          source: input.source,
          createdAt: '2026-01-01T00:00:00.000Z',
        })),
      },
    };
  }),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator: () => async (context: any, next: () => Promise<void>) => {
    context.set('user', { id: 'user-1' });
    context.set('cultivator', {
      id: 'cultivator-1',
    });
    await next();
  },
}));

vi.mock('@server/lib/dungeon/service_v2', () => ({
  DungeonFlowError: DungeonFlowErrorMock,
  dungeonService: {
    startDungeon: startDungeonMock,
    getState: vi.fn(),
    handleAction: handleActionMock,
    quitDungeon: quitDungeonMock,
    continueFromLooting: continueFromLootingMock,
    escapeFromLooting: escapeFromLootingMock,
    probeBattleEnemy: probeBattleEnemyMock,
    abandonBattle: abandonBattleMock,
    executeBattle: executeBattleMock,
    recoverDungeon: recoverDungeonMock,
  },
}));

vi.mock('@server/lib/services/TaskService', () => ({
  TaskService: {
    listCultivatorTasks: listCultivatorTasksMock,
  },
}));

vi.mock('@server/lib/services/QiService', () => ({
  QiInsufficientError: QiInsufficientErrorMock,
  QiServiceError: QiServiceErrorMock,
}));

vi.mock('@server/lib/services/cultivatorService', () => ({
  getCultivatorByIdUnsafe: getCultivatorByIdUnsafeMock,
}));

vi.mock('@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter', () => ({
  getCultivatorDisplaySnapshot: getCultivatorDisplaySnapshotMock,
}));

vi.mock('@shared/lib/game/mapSystem', () => ({
  getMapNode: getMapNodeMock,
  isSatelliteNode: isSatelliteNodeMock,
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

vi.mock('@server/lib/services/PlayerStateMutationService', () => ({
  commitPlayerStateMutation: commitPlayerStateMutationMock,
  toPlayerStateMutationResponse: (committed: any) => ({
    success: true,
    data: committed.result,
    state: committed.state,
  }),
}));

import router from './dungeon.router';

function createApp() {
  return new Hono().route('/api/dungeon', router);
}

describe('dungeon battle router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCultivatorTasksMock.mockResolvedValue([]);
    getCultivatorByIdUnsafeMock.mockResolvedValue({
      cultivator: {
        id: 'cultivator-1',
        realm: '炼气',
        inventory: {
          artifacts: [],
          consumables: [],
          materials: [],
        },
        equipped: {
          weapon: null,
          armor: null,
          accessory: null,
        },
      },
    });
    getCultivatorDisplaySnapshotMock.mockReturnValue({
      resources: {
        hp: { current: 100, max: 100, percent: 100 },
        mp: { current: 100, max: 100, percent: 100 },
      },
    });
    getMapNodeMock.mockReturnValue({
      id: 'node-1',
      realm_requirement: '炼气',
    });
    isSatelliteNodeMock.mockReturnValue(true);
  });

  it('starts a dungeon when novice readiness passes', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const afterCommit = vi.fn().mockResolvedValue(undefined);
    startDungeonMock.mockResolvedValueOnce({
      state: {
        id: 'dungeon-state-1',
      },
      persist,
      afterCommit,
    });

    const response = await createApp().request('/api/dungeon/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mapNodeId: 'node-1',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: { state: { id: 'dungeon-state-1' } },
        state: expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({ source: 'dungeon_start' }),
          ]),
        }),
      }),
    );
    expect(startDungeonMock).toHaveBeenCalledWith('cultivator-1', 'node-1', {
      deferPersistence: true,
    });
    expect(persist).toHaveBeenCalledWith({ __tx: true });
    expect(afterCommit).toHaveBeenCalledTimes(1);
    expect(persist.mock.invocationCallOrder[0]).toBeLessThan(
      afterCommit.mock.invocationCallOrder[0],
    );
  });

  it('rejects dungeon start for main map nodes (only satellite nodes allowed)', async () => {
    isSatelliteNodeMock.mockReturnValueOnce(false);

    const response = await createApp().request('/api/dungeon/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mapNodeId: 'TN_YUE_01',
      }),
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain('只有秘境节点可以进行副本挑战');
    expect(startDungeonMock).not.toHaveBeenCalled();
  });

  it('returns 409 when starting a dungeon lacks qi', async () => {
    startDungeonMock.mockRejectedValueOnce(
      new QiInsufficientErrorMock({
        action: 'dungeon_start',
        required: 50,
        current: 30,
      }),
    );

    const response = await createApp().request('/api/dungeon/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mapNodeId: 'node-1',
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'QI_INSUFFICIENT',
      message: '天地灵气不足',
      required: 50,
      current: 30,
      action: 'dungeon_start',
    });
  });

  it('blocks the first dungeon when novice readiness fails', async () => {
    listCultivatorTasksMock.mockResolvedValueOnce([
      {
        definitionId: 'tutorial_first_dungeon',
        snapshot: {
          isCompleted: false,
        },
      },
    ]);
    getCultivatorDisplaySnapshotMock.mockReturnValueOnce({
      resources: {
        hp: { current: 40, max: 100, percent: 40 },
        mp: { current: 100, max: 100, percent: 100 },
      },
    });

    const response = await createApp().request('/api/dungeon/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mapNodeId: 'node-1',
      }),
    });

    expect(response.status).toBe(409);
    const payload = (await response.json()) as {
      error: string;
      readiness: { shouldBlock: boolean };
    };
    expect(payload.error).toContain('气血仅 40%');
    expect(payload.readiness.shouldBlock).toBe(true);
    expect(startDungeonMock).not.toHaveBeenCalled();
  });

  it('does not block the first dungeon only because novice equipment is missing', async () => {
    listCultivatorTasksMock.mockResolvedValueOnce([
      {
        definitionId: 'tutorial_first_dungeon',
        snapshot: {
          isCompleted: false,
        },
      },
    ]);
    startDungeonMock.mockResolvedValueOnce({
      state: {
        id: 'dungeon-state-1',
      },
    });

    const response = await createApp().request('/api/dungeon/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mapNodeId: 'node-1',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: { state: { id: 'dungeon-state-1' } },
        state: expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({ source: 'dungeon_start' }),
          ]),
        }),
      }),
    );
    expect(startDungeonMock).toHaveBeenCalledWith('cultivator-1', 'node-1', {
      deferPersistence: true,
    });
  });

  it('returns 409 when dungeon action is already being processed', async () => {
    handleActionMock.mockRejectedValueOnce(
      new DungeonFlowErrorMock(
        'DUNGEON_INVALID_STATE',
        '副本操作正在处理中，请稍后重试',
        409,
      ),
    );

    const response = await createApp().request('/api/dungeon/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        choiceId: 1,
        actionId: 'action-1',
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: '副本操作正在处理中，请稍后重试',
      code: 'DUNGEON_INVALID_STATE',
    });
  });

  it('probes the current dungeon enemy via GET /api/dungeon/battle/probe', async () => {
    probeBattleEnemyMock.mockResolvedValueOnce({
      id: 'enemy-1',
      name: '守陵阴魂',
    });

    const response = await createApp().request(
      '/api/dungeon/battle/probe?battleId=battle-1',
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      enemy: {
        id: 'enemy-1',
        name: '守陵阴魂',
      },
    });
    expect(probeBattleEnemyMock).toHaveBeenCalledWith(
      'cultivator-1',
      'battle-1',
    );
  });

  it('abandons the current dungeon battle via POST /api/dungeon/battle/abandon', async () => {
    abandonBattleMock.mockResolvedValueOnce({
      isFinished: true,
      settlement: {
        ending_narrative: '你见势不妙，及时抽身而退。',
      },
      realGains: [],
    });

    const response = await createApp().request('/api/dungeon/battle/abandon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        battleId: 'battle-1',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: {
          isFinished: true,
          settlement: {
            ending_narrative: '你见势不妙，及时抽身而退。',
          },
          realGains: [],
        },
        state: expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({ domain: 'tasks' }),
          ]),
        }),
      }),
    );
    expect(abandonBattleMock).toHaveBeenCalledWith(
      'cultivator-1',
      'battle-1',
      { deferPersistence: true },
    );
  });

  it('returns 409 when abandoning a dungeon battle while another flow is processing', async () => {
    abandonBattleMock.mockRejectedValueOnce(
      new DungeonFlowErrorMock(
        'DUNGEON_INVALID_STATE',
        '副本操作正在处理中，请稍后重试',
        409,
      ),
    );

    const response = await createApp().request('/api/dungeon/battle/abandon', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        battleId: 'battle-1',
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: '副本操作正在处理中，请稍后重试',
      code: 'DUNGEON_INVALID_STATE',
    });
  });

  it('executes the current dungeon battle via POST /api/dungeon/battle/execute/v5', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const afterCommit = vi.fn().mockResolvedValue(undefined);
    executeBattleMock.mockResolvedValueOnce({
      battleResult: {
        turns: 3,
        winner: { id: 'cultivator-1', name: '韩立' },
        loser: { id: 'enemy-1', name: '守陵阴魂' },
      },
      state: {
        activeBattleId: undefined,
        status: 'LOOTING',
      },
      isFinished: false,
      roundData: undefined,
      settlement: undefined,
      realGains: undefined,
      persist,
      afterCommit,
    });

    const response = await createApp().request(
      '/api/dungeon/battle/execute/v5',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          battleId: 'battle-1',
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: {
          battleResult: {
            turns: 3,
            winner: { id: 'cultivator-1', name: '韩立' },
            loser: { id: 'enemy-1', name: '守陵阴魂' },
          },
          callbackData: expect.objectContaining({
            dungeonState: {
              status: 'LOOTING',
            },
            isFinished: false,
          }),
        },
        state: expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({ source: 'dungeon_battle_execute' }),
          ]),
        }),
      }),
    );
    expect(executeBattleMock).toHaveBeenCalledWith(
      'cultivator-1',
      'battle-1',
      { deferPersistence: true },
    );
    expect(persist).toHaveBeenCalledWith({ __tx: true });
    expect(afterCommit).toHaveBeenCalledTimes(1);
  });

  it('quits a dungeon through the deferred mutation boundary', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const afterCommit = vi.fn().mockResolvedValue(undefined);
    quitDungeonMock.mockResolvedValueOnce({
      success: true,
      persist,
      afterCommit,
    });

    const response = await createApp().request('/api/dungeon/quit', {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: { success: true },
        state: expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({ source: 'dungeon_quit' }),
          ]),
        }),
      }),
    );
    expect(quitDungeonMock).toHaveBeenCalledWith('cultivator-1', {
      deferPersistence: true,
    });
    expect(persist).toHaveBeenCalledWith({ __tx: true });
    expect(afterCommit).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when executing a dungeon battle while another flow is processing', async () => {
    executeBattleMock.mockRejectedValueOnce(
      new DungeonFlowErrorMock(
        'DUNGEON_INVALID_STATE',
        '副本操作正在处理中，请稍后重试',
        409,
      ),
    );

    const response = await createApp().request(
      '/api/dungeon/battle/execute/v5',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          battleId: 'battle-1',
        }),
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: '副本操作正在处理中，请稍后重试',
      code: 'DUNGEON_INVALID_STATE',
    });
  });

  it('continues from dungeon looting via POST /api/dungeon/looting/continue', async () => {
    continueFromLootingMock.mockResolvedValueOnce({
      state: {
        status: 'EXPLORING',
        currentRound: 3,
      },
      roundData: {
        scene_description: '你继续深入秘境。',
      },
      isFinished: false,
    });

    const response = await createApp().request(
      '/api/dungeon/looting/continue',
      {
        method: 'POST',
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: {
          state: {
            status: 'EXPLORING',
            currentRound: 3,
          },
          roundData: {
            scene_description: '你继续深入秘境。',
          },
          isFinished: false,
        },
        state: expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({ source: 'dungeon_looting_continue' }),
          ]),
        }),
      }),
    );
    expect(continueFromLootingMock).toHaveBeenCalledWith('cultivator-1', {
      deferPersistence: true,
    });
  });

  it('returns 409 when continuing from looting after dungeon state changed', async () => {
    continueFromLootingMock.mockRejectedValueOnce(
      new DungeonFlowErrorMock(
        'DUNGEON_INVALID_STATE',
        '当前副本状态已变化，请刷新后重试',
        409,
      ),
    );

    const response = await createApp().request(
      '/api/dungeon/looting/continue',
      {
        method: 'POST',
      },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: '当前副本状态已变化，请刷新后重试',
      code: 'DUNGEON_INVALID_STATE',
    });
  });

  it('returns a business 500 when continuing from looting fails unexpectedly', async () => {
    continueFromLootingMock.mockRejectedValueOnce(new Error('副本推进失败'));

    const response = await createApp().request(
      '/api/dungeon/looting/continue',
      {
        method: 'POST',
      },
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: '副本推进失败',
    });
  });

  it('returns 409 when escaping from looting after dungeon state changed', async () => {
    escapeFromLootingMock.mockRejectedValueOnce(
      new DungeonFlowErrorMock(
        'DUNGEON_INVALID_STATE',
        '当前副本状态已变化，请刷新后重试',
        409,
      ),
    );

    const response = await createApp().request('/api/dungeon/looting/escape', {
      method: 'POST',
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: '当前副本状态已变化，请刷新后重试',
      code: 'DUNGEON_INVALID_STATE',
    });
  });

  it('recovers a dungeon via POST /api/dungeon/recover', async () => {
    recoverDungeonMock.mockResolvedValueOnce({
      state: {
        status: 'EXPLORING',
      },
      isFinished: false,
    });

    const response = await createApp().request('/api/dungeon/recover', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'retry',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: {
          state: {
            status: 'EXPLORING',
          },
          isFinished: false,
        },
        state: expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({ source: 'dungeon_recover_retry' }),
          ]),
        }),
      }),
    );
    expect(recoverDungeonMock).toHaveBeenCalledWith('cultivator-1', 'retry', {
      deferPersistence: true,
    });
  });

  it('accepts explicit recover actions for continue and settlement retries', async () => {
    recoverDungeonMock
      .mockResolvedValueOnce({
        state: {
          status: 'EXPLORING',
        },
        isFinished: false,
      })
      .mockResolvedValueOnce({
        isFinished: true,
        settlement: {
          ending_narrative: '结算完成',
        },
        realGains: [],
      });

    const retryContinueResponse = await createApp().request(
      '/api/dungeon/recover',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'retry_continue',
        }),
      },
    );
    const retrySettleResponse = await createApp().request(
      '/api/dungeon/recover',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'retry_settle',
        }),
      },
    );

    expect(retryContinueResponse.status).toBe(200);
    expect(retrySettleResponse.status).toBe(200);
    expect(recoverDungeonMock).toHaveBeenNthCalledWith(
      1,
      'cultivator-1',
      'retry_continue',
      { deferPersistence: true },
    );
    expect(recoverDungeonMock).toHaveBeenNthCalledWith(
      2,
      'cultivator-1',
      'retry_settle',
      { deferPersistence: true },
    );
  });
});
