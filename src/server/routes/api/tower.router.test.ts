import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  startRunMock,
  getStateMock,
  resetRunMock,
  chooseBlessingMock,
  probeBattleMock,
  getBattleContextMock,
  executeBattleMock,
  getLeaderboardMock,
  commitPlayerStateMutationMock,
} = vi.hoisted(() => ({
  startRunMock: vi.fn(),
  getStateMock: vi.fn(),
  resetRunMock: vi.fn(),
  chooseBlessingMock: vi.fn(),
  probeBattleMock: vi.fn(),
  getBattleContextMock: vi.fn(),
  executeBattleMock: vi.fn(),
  getLeaderboardMock: vi.fn(),
  commitPlayerStateMutationMock: vi.fn(async (input: any) => {
    const { result, changes } = await input.run({ __tx: true });
    return {
      result,
      state: {
        cultivatorId: input.cultivatorId,
        globalVersion: 30,
        domainVersions: Object.fromEntries(
          changes.map((change: any) => [change.domain, 30]),
        ),
        events: changes.map((change: any, index: number) => ({
          id: index + 1,
          cultivatorId: input.cultivatorId,
          globalVersion: 30,
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
    context.set('cultivator', { id: 'cultivator-1' });
    await next();
  },
}));

vi.mock('@server/lib/tower/service', () => ({
  towerService: {
    startRun: startRunMock,
    getState: getStateMock,
    resetRun: resetRunMock,
    chooseBlessing: chooseBlessingMock,
    probeBattle: probeBattleMock,
    getBattleContext: getBattleContextMock,
    executeBattle: executeBattleMock,
    getLeaderboard: getLeaderboardMock,
  },
}));

vi.mock('@server/lib/services/PlayerStateMutationService', () => ({
  commitPlayerStateMutation: commitPlayerStateMutationMock,
  toPlayerStateMutationResponse: (committed: any) => ({
    success: true,
    data: committed.result,
    state: committed.state,
  }),
}));

import towerRouter from './tower.router';

function createApp() {
  return new Hono().route('/api/tower', towerRouter);
}

describe('tower router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts a weekly tower run', async () => {
    startRunMock.mockResolvedValueOnce({
      season: { seasonKey: '2026-W22@Asia/Shanghai' },
      state: { currentFloor: 1, status: 'READY' },
    });

    const response = await createApp().request('/api/tower/start', {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      season: { seasonKey: '2026-W22@Asia/Shanghai' },
      state: { currentFloor: 1, status: 'READY' },
    });
    expect(startRunMock).toHaveBeenCalledWith('cultivator-1');
  });

  it('probes and executes a tower battle', async () => {
    probeBattleMock.mockResolvedValueOnce({
      season: { seasonKey: '2026-W22@Asia/Shanghai' },
      state: {
        status: 'WAITING_BATTLE',
        activeBattleId: 'battle-1',
      },
      battleId: 'battle-1',
      encounter: { floor: 5, kind: 'elite' },
      enemy: { id: 'enemy-1', name: '守塔者' },
    });
    executeBattleMock.mockResolvedValueOnce({
      battleResult: {
        turns: 3,
        winner: { id: 'cultivator-1', name: '韩立' },
        loser: { id: 'enemy-1', name: '守塔者' },
      },
      state: { status: 'CHOOSING_BLESSING' },
      isFinished: false,
      settlement: undefined,
      milestoneReward: undefined,
    });

    const probeResponse = await createApp().request('/api/tower/battle/probe', {
      method: 'POST',
    });
    expect(probeResponse.status).toBe(200);
    await expect(probeResponse.json()).resolves.toEqual({
      season: { seasonKey: '2026-W22@Asia/Shanghai' },
      state: {
        status: 'WAITING_BATTLE',
        activeBattleId: 'battle-1',
      },
      battleId: 'battle-1',
      encounter: { floor: 5, kind: 'elite' },
      enemy: { id: 'enemy-1', name: '守塔者' },
    });

    getBattleContextMock.mockResolvedValueOnce({
      battleId: 'battle-1',
      encounter: { floor: 5, kind: 'elite' },
      enemy: { id: 'enemy-1', name: '守塔者' },
    });

    const contextResponse = await createApp().request(
      '/api/tower/battle/context?battleId=battle-1',
    );
    expect(contextResponse.status).toBe(200);
    await expect(contextResponse.json()).resolves.toEqual({
      battleId: 'battle-1',
      encounter: { floor: 5, kind: 'elite' },
      enemy: { id: 'enemy-1', name: '守塔者' },
    });
    expect(getBattleContextMock).toHaveBeenCalledWith(
      'cultivator-1',
      'battle-1',
    );

    const executeResponse = await createApp().request(
      '/api/tower/battle/execute/v5',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId: 'battle-1' }),
      },
    );
    expect(executeResponse.status).toBe(200);
    await expect(executeResponse.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: {
          battleResult: {
            turns: 3,
            winner: { id: 'cultivator-1', name: '韩立' },
            loser: { id: 'enemy-1', name: '守塔者' },
          },
          callbackData: expect.objectContaining({
            towerState: { status: 'CHOOSING_BLESSING' },
            isFinished: false,
          }),
        },
      }),
    );
    expect(commitPlayerStateMutationMock).not.toHaveBeenCalled();
  });

  it('emits only mail state when tower battle creates milestone mail', async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const afterCommit = vi.fn().mockResolvedValue(undefined);
    executeBattleMock.mockResolvedValueOnce({
      battleResult: {
        turns: 4,
        winner: { id: 'cultivator-1', name: '韩立' },
        loser: { id: 'enemy-1', name: '守塔者' },
      },
      state: { status: 'CHOOSING_BLESSING' },
      isFinished: false,
      settlement: undefined,
      milestoneReward: { floor: 5, title: '五层馈赠' },
      persist,
      afterCommit,
    });

    const response = await createApp().request('/api/tower/battle/execute/v5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ battleId: 'battle-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          callbackData: expect.objectContaining({
            milestoneReward: { floor: 5, title: '五层馈赠' },
          }),
        }),
        state: expect.objectContaining({
          events: [
            expect.objectContaining({
              domain: 'mail',
              eventType: 'mail.tower_milestone.created',
              source: 'tower_battle_execute',
            }),
          ],
        }),
      }),
    );
    expect(persist).toHaveBeenCalledWith({ __tx: true });
    expect(afterCommit).toHaveBeenCalledTimes(1);
    const run = commitPlayerStateMutationMock.mock.calls[0][0].run;
    const { changes } = await run({ __tx: true });
    expect(changes).toEqual([
      {
        domain: 'mail',
        eventType: 'mail.tower_milestone.created',
        invalidates: ['mail'],
      },
    ]);
  });

  it('returns leaderboard entries for a realm bucket', async () => {
    getLeaderboardMock.mockResolvedValueOnce({
      season: { seasonKey: '2026-W22@Asia/Shanghai' },
      realm: '金丹',
      entries: [{ cultivatorId: 'cultivator-1', highestFloor: 18 }],
    });

    const response = await createApp().request(
      '/api/tower/leaderboard?realm=%E9%87%91%E4%B8%B9&limit=30',
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      season: { seasonKey: '2026-W22@Asia/Shanghai' },
      realm: '金丹',
      entries: [{ cultivatorId: 'cultivator-1', highestFloor: 18 }],
    });
    expect(getLeaderboardMock).toHaveBeenCalledWith(
      'cultivator-1',
      '金丹',
      30,
    );
  });

  it('rejects leaderboard realms below tower eligibility', async () => {
    const response = await createApp().request(
      '/api/tower/leaderboard?realm=%E7%AD%91%E5%9F%BA&limit=30',
    );

    expect(response.status).toBe(400);
    expect(getLeaderboardMock).not.toHaveBeenCalled();
  });
});
