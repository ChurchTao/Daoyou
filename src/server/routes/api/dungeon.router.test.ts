import { Hono } from 'hono';

const {
  probeBattleEnemyMock,
  abandonBattleMock,
  executeBattleMock,
} = vi.hoisted(() => ({
  probeBattleEnemyMock: vi.fn(),
  abandonBattleMock: vi.fn(),
  executeBattleMock: vi.fn(),
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
    startDungeon: vi.fn(),
    getState: vi.fn(),
    handleAction: vi.fn(),
    quitDungeon: vi.fn(),
    continueFromLooting: vi.fn(),
    escapeFromLooting: vi.fn(),
    probeBattleEnemy: probeBattleEnemyMock,
    abandonBattle: abandonBattleMock,
    executeBattle: executeBattleMock,
  },
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
});
