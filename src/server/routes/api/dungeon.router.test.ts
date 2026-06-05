import { Hono } from 'hono';

const {
  startDungeonMock,
  probeBattleEnemyMock,
  abandonBattleMock,
  executeBattleMock,
  recoverDungeonMock,
  listCultivatorTasksMock,
  getCultivatorByIdUnsafeMock,
  getCultivatorDisplaySnapshotMock,
  getMapNodeMock,
} = vi.hoisted(() => ({
  startDungeonMock: vi.fn(),
  probeBattleEnemyMock: vi.fn(),
  abandonBattleMock: vi.fn(),
  executeBattleMock: vi.fn(),
  recoverDungeonMock: vi.fn(),
  listCultivatorTasksMock: vi.fn(),
  getCultivatorByIdUnsafeMock: vi.fn(),
  getCultivatorDisplaySnapshotMock: vi.fn(),
  getMapNodeMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator: () => async (context: any, next: () => Promise<void>) => {
    context.set('cultivator', {
      id: 'cultivator-1',
    });
    await next();
  },
}));

vi.mock('@server/lib/dungeon/service_v2', () => ({
  dungeonService: {
    startDungeon: startDungeonMock,
    getState: vi.fn(),
    handleAction: vi.fn(),
    quitDungeon: vi.fn(),
    continueFromLooting: vi.fn(),
    escapeFromLooting: vi.fn(),
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

vi.mock('@server/lib/services/cultivatorService', () => ({
  getCultivatorByIdUnsafe: getCultivatorByIdUnsafeMock,
}));

vi.mock('@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter', () => ({
  getCultivatorDisplaySnapshot: getCultivatorDisplaySnapshotMock,
}));

vi.mock('@shared/lib/game/mapSystem', () => ({
  getMapNode: getMapNodeMock,
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
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
  });

  it('starts a dungeon when novice readiness passes', async () => {
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
    await expect(response.json()).resolves.toEqual({
      state: {
        id: 'dungeon-state-1',
      },
    });
    expect(startDungeonMock).toHaveBeenCalledWith('cultivator-1', 'node-1');
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
    await expect(response.json()).resolves.toEqual({
      state: {
        id: 'dungeon-state-1',
      },
    });
    expect(startDungeonMock).toHaveBeenCalledWith('cultivator-1', 'node-1');
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
    await expect(response.json()).resolves.toEqual({
      isFinished: true,
      settlement: {
        ending_narrative: '你见势不妙，及时抽身而退。',
      },
      realGains: [],
    });
    expect(abandonBattleMock).toHaveBeenCalledWith(
      'cultivator-1',
      'battle-1',
    );
  });

  it('executes the current dungeon battle via POST /api/dungeon/battle/execute/v5', async () => {
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
    await expect(response.json()).resolves.toEqual({
      battleResult: {
        turns: 3,
        winner: { id: 'cultivator-1', name: '韩立' },
        loser: { id: 'enemy-1', name: '守陵阴魂' },
      },
      callbackData: {
        dungeonState: {
          activeBattleId: undefined,
          status: 'LOOTING',
        },
        roundData: undefined,
        isFinished: false,
        settlement: undefined,
        realGains: undefined,
      },
    });
    expect(executeBattleMock).toHaveBeenCalledWith(
      'cultivator-1',
      'battle-1',
    );
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
    await expect(response.json()).resolves.toEqual({
      state: {
        status: 'EXPLORING',
      },
      isFinished: false,
    });
    expect(recoverDungeonMock).toHaveBeenCalledWith('cultivator-1', 'retry');
  });
});
