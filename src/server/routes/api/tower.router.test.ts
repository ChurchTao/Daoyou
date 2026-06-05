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
} = vi.hoisted(() => ({
  startRunMock: vi.fn(),
  getStateMock: vi.fn(),
  resetRunMock: vi.fn(),
  chooseBlessingMock: vi.fn(),
  probeBattleMock: vi.fn(),
  getBattleContextMock: vi.fn(),
  executeBattleMock: vi.fn(),
  getLeaderboardMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator: () => async (context: any, next: () => Promise<void>) => {
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
    await expect(executeResponse.json()).resolves.toEqual({
      battleResult: {
        turns: 3,
        winner: { id: 'cultivator-1', name: '韩立' },
        loser: { id: 'enemy-1', name: '守塔者' },
      },
      callbackData: {
        towerState: { status: 'CHOOSING_BLESSING' },
        isFinished: false,
        settlement: undefined,
        milestoneReward: undefined,
      },
    });
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
