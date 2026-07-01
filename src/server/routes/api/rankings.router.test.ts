import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  checkDailyChallengesMock,
  isRankingEmptyMock,
  getCultivatorRankMock,
  acquireChallengeLockMock,
  getCultivatorByIdUnsafeMock,
  simulateBattleV5Mock,
  incrementDailyChallengesMock,
  createBattleRecordV2Mock,
  releaseChallengeLockMock,
  recordTaskEventMock,
  commitPlayerStateMutationMock,
  updateRankingMock,
  addToRankingTailIfVacantMock,
  addToRankingMock,
  getRankingListMock,
  getRemainingChallengesMock,
  isLockedMock,
  createMessageMock,
} = vi.hoisted(() => ({
  checkDailyChallengesMock: vi.fn(),
  isRankingEmptyMock: vi.fn(),
  getCultivatorRankMock: vi.fn(),
  acquireChallengeLockMock: vi.fn(),
  getCultivatorByIdUnsafeMock: vi.fn(),
  simulateBattleV5Mock: vi.fn(),
  incrementDailyChallengesMock: vi.fn(),
  createBattleRecordV2Mock: vi.fn(),
  releaseChallengeLockMock: vi.fn(),
  recordTaskEventMock: vi.fn(),
  commitPlayerStateMutationMock: vi.fn(async (input: any) => {
    const result = await input.run('tx');
    return {
      result: result.result,
      state: {
        cultivatorId: input.cultivatorId,
        globalVersion: 1,
        domainVersions: { tasks: 1 },
        events: result.changes.map((change: any, index: number) => ({
          id: index + 1,
          cultivatorId: input.cultivatorId,
          globalVersion: 1,
          domainVersion: 1,
          source: input.source,
          patch: {},
          invalidates: change.invalidates ?? [],
          createdAt: '2026-06-10T00:00:00.000Z',
          ...change,
        })),
      },
    };
  }),
  updateRankingMock: vi.fn(),
  addToRankingTailIfVacantMock: vi.fn(),
  addToRankingMock: vi.fn(),
  getRankingListMock: vi.fn(),
  getRemainingChallengesMock: vi.fn(),
  isLockedMock: vi.fn(() => false),
  createMessageMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('user', { id: 'user-1' });
      context.set('cultivator', {
        id: 'cultivator-1',
        name: '韩立',
        realm: '筑基',
      });
      await next();
    },
}));

vi.mock('@shared/engine/creation-v2/persistence/ProductPersistenceMapper', () => ({
  deserializeAndRehydrate: vi.fn(),
}));

vi.mock('@shared/engine/creation-v2/models/AbilityProjection', () => ({
  projectAbilityConfig: vi.fn(() => ({ cooldown: 0, mpCost: 0 })),
}));

vi.mock('@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter', () => ({
  getCultivatorDisplayAttributes: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

vi.mock('@server/lib/drizzle/schema', () => ({
  consumables: {},
  creationProducts: {},
  cultivators: {},
}));

vi.mock('@server/lib/redis/rankings', () => ({
  acquireChallengeLock: acquireChallengeLockMock,
  addToRankingTailIfVacant: addToRankingTailIfVacantMock,
  addToRanking: addToRankingMock,
  checkDailyChallenges: checkDailyChallengesMock,
  getCultivatorRank: getCultivatorRankMock,
  getRankingList: getRankingListMock,
  getRemainingChallenges: getRemainingChallengesMock,
  incrementDailyChallenges: incrementDailyChallengesMock,
  isLocked: isLockedMock,
  isRankingEmpty: isRankingEmptyMock,
  releaseChallengeLock: releaseChallengeLockMock,
  updateRanking: updateRankingMock,
}));

vi.mock('@server/lib/repositories/battleRecordV2Repository', () => ({
  createBattleRecordV2: createBattleRecordV2Mock,
}));

vi.mock('@server/lib/repositories/worldChatRepository', () => ({
  createMessage: createMessageMock,
}));

vi.mock('@server/lib/services/cultivatorService', () => ({
  getCultivatorByIdUnsafe: getCultivatorByIdUnsafeMock,
  getPlayerRuntimeCultivatorByIdUnsafe: getCultivatorByIdUnsafeMock,
}));

vi.mock('@server/lib/services/simulateBattleV5', () => ({
  simulateBattleV5: simulateBattleV5Mock,
}));

vi.mock('@server/lib/services/TaskService', () => ({
  TaskService: {
    recordTaskEvent: recordTaskEventMock,
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

import rankingsRouter from './rankings.router';

function createApp() {
  return new Hono().route('/api/rankings', rankingsRouter);
}

describe('rankings router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkDailyChallengesMock.mockResolvedValue({ success: true, remaining: 10 });
    isRankingEmptyMock.mockResolvedValue(false);
    getRemainingChallengesMock.mockResolvedValue(10);
    getCultivatorRankMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    acquireChallengeLockMock.mockResolvedValue(true);
    getCultivatorByIdUnsafeMock
      .mockResolvedValueOnce({
        cultivator: {
          id: 'cultivator-1',
          name: '韩立',
          realm: '筑基',
          realm_stage: '中期',
        },
      })
      .mockResolvedValueOnce({
        cultivator: {
          id: 'target-1',
          name: '厉飞雨',
          realm: '筑基',
          realm_stage: '中期',
        },
      });
    simulateBattleV5Mock.mockReturnValue({
      winner: { id: 'cultivator-1' },
      loser: { id: 'target-1' },
    });
    incrementDailyChallengesMock.mockResolvedValue(9);
    createBattleRecordV2Mock.mockResolvedValue(undefined);
    releaseChallengeLockMock.mockResolvedValue(undefined);
    recordTaskEventMock.mockResolvedValue([]);
    updateRankingMock.mockResolvedValue(undefined);
    addToRankingTailIfVacantMock.mockResolvedValue(null);
    addToRankingMock.mockResolvedValue(undefined);
    getRankingListMock.mockResolvedValue([]);
    createMessageMock.mockResolvedValue({ id: 'chat-1' });
  });

  it('loads battle ranking and my rank from the requested realm bucket', async () => {
    getRankingListMock.mockResolvedValueOnce([{ id: 'target-1', rank: 1 }]);
    getCultivatorRankMock.mockReset();
    getCultivatorRankMock.mockResolvedValueOnce(3);

    const listResponse = await createApp().request(
      '/api/rankings?realm=%E9%87%91%E4%B8%B9',
    );
    const listJson = (await listResponse.json()) as {
      realm: string;
      data: unknown;
    };

    expect(listResponse.status).toBe(200);
    expect(listJson.realm).toBe('金丹');
    expect(getRankingListMock).toHaveBeenCalledWith('金丹');

    const rankResponse = await createApp().request(
      '/api/rankings/my-rank?realm=%E9%87%91%E4%B8%B9',
    );
    const rankJson = (await rankResponse.json()) as {
      data: { realm: string; rank: number | null };
    };

    expect(rankResponse.status).toBe(200);
    expect(rankJson.data).toMatchObject({ realm: '金丹', rank: 3 });
    expect(getCultivatorRankMock).toHaveBeenCalledWith('金丹', 'cultivator-1');
  });

  it('records the daily ranking task only after a challenge battle completes', async () => {
    const response = await createApp().request(
      '/api/rankings/challenge-battle/v5',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId: 'target-1',
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(recordTaskEventMock).toHaveBeenCalledWith(
      'cultivator-1',
      'ranking_challenge_battled',
      { tx: 'tx' },
    );
    expect(createBattleRecordV2Mock).toHaveBeenCalledTimes(1);
    expect(updateRankingMock).toHaveBeenCalledWith(
      '筑基',
      'cultivator-1',
      'target-1',
    );
    expect(createMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        senderCultivatorId: null,
        senderName: '修仙界传闻',
        messageType: 'text',
        textContent: '万界金榜有感，韩立击败厉飞雨，登临筑基天骄榜第1名。',
        payload: {
          text: '万界金榜有感，韩立击败厉飞雨，登临筑基天骄榜第1名。',
        },
      }),
    );
  });

  it('starts ranking challenge battles with full hp/mp instead of persisted resources', async () => {
    getCultivatorByIdUnsafeMock.mockReset();
    getCultivatorByIdUnsafeMock
      .mockResolvedValueOnce({
        cultivator: {
          id: 'cultivator-1',
          name: '韩立',
          realm: '筑基',
          realm_stage: '中期',
          condition: {
            resources: {
              hp: { current: 12 },
              mp: { current: 3 },
            },
          },
        },
      })
      .mockResolvedValueOnce({
        cultivator: {
          id: 'target-1',
          name: '厉飞雨',
          realm: '筑基',
          realm_stage: '中期',
          condition: {
            resources: {
              hp: { current: 27 },
              mp: { current: 8 },
            },
          },
        },
      });

    const response = await createApp().request(
      '/api/rankings/challenge-battle/v5',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId: 'target-1',
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(simulateBattleV5Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cultivator-1',
        condition: {
          resources: {
            hp: { current: 12 },
            mp: { current: 3 },
          },
        },
      }),
      expect.objectContaining({
        id: 'target-1',
        condition: {
          resources: {
            hp: { current: 27 },
            mp: { current: 8 },
          },
        },
      }),
      {
        player: {
          resourceState: {
            hp: { mode: 'percent', value: 1 },
            mp: { mode: 'percent', value: 1 },
          },
        },
        opponent: {
          resourceState: {
            hp: { mode: 'percent', value: 1 },
            mp: { mode: 'percent', value: 1 },
          },
        },
      },
    );
  });

  it('does not update ranking for cross-realm challenge battles', async () => {
    getCultivatorRankMock.mockReset();
    getCultivatorRankMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(1);

    const response = await createApp().request(
      '/api/rankings/challenge-battle/v5',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId: 'target-1',
          realm: '金丹',
        }),
      },
    );
    const result = (await response.json()) as {
      data: {
        rankingUpdate: {
          isWin: boolean;
          realm: string;
          affectsRanking: boolean;
          challengerRank: number | null;
          targetRank: number | null;
          remainingChallenges: number;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(result.data.rankingUpdate).toMatchObject({
      isWin: true,
      realm: '金丹',
      affectsRanking: false,
      challengerRank: null,
      targetRank: 1,
      remainingChallenges: 9,
    });
    expect(updateRankingMock).not.toHaveBeenCalled();
    expect(createBattleRecordV2Mock).toHaveBeenCalledTimes(1);
    expect(recordTaskEventMock).toHaveBeenCalledWith(
      'cultivator-1',
      'ranking_challenge_battled',
      { tx: 'tx' },
    );
  });

  it('allows direct entry only on the cultivator own realm ranking', async () => {
    isRankingEmptyMock.mockResolvedValue(true);
    getCultivatorRankMock.mockReset();
    getCultivatorRankMock.mockResolvedValue(null);

    const ownRealmResponse = await createApp().request(
      '/api/rankings/challenge-battle/v5',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId: null,
          realm: '筑基',
        }),
      },
    );

    expect(ownRealmResponse.status).toBe(200);
    expect(addToRankingMock).toHaveBeenCalledWith(
      '筑基',
      'cultivator-1',
      'user-1',
      1,
    );
    expect(createMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        textContent: '万界金榜初开，韩立登临筑基天骄榜第1名。',
        payload: { text: '万界金榜初开，韩立登临筑基天骄榜第1名。' },
      }),
    );

    vi.clearAllMocks();
    checkDailyChallengesMock.mockResolvedValue({ success: true, remaining: 10 });
    isRankingEmptyMock.mockResolvedValue(true);
    getCultivatorRankMock.mockResolvedValue(null);

    const crossRealmResponse = await createApp().request(
      '/api/rankings/challenge-battle/v5',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId: null,
          realm: '金丹',
        }),
      },
    );

    expect(crossRealmResponse.status).toBe(400);
    expect(addToRankingMock).not.toHaveBeenCalled();
  });

  it('allows cross-realm challenge validation without ranking changes', async () => {
    getCultivatorRankMock.mockReset();
    getCultivatorRankMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(1);

    const response = await createApp().request('/api/rankings/challenge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetId: 'target-1',
        realm: '金丹',
      }),
    });
    const result = (await response.json()) as {
      data: {
        realm: string;
        challengerRank: number | null;
        targetRank: number | null;
        affectsRanking: boolean;
      };
    };

    expect(response.status).toBe(200);
    expect(result.data).toMatchObject({
      realm: '金丹',
      challengerRank: null,
      targetRank: 1,
      affectsRanking: false,
    });
    expect(updateRankingMock).not.toHaveBeenCalled();
  });

  it('rejects a target that is not on the requested realm ranking', async () => {
    getCultivatorRankMock.mockReset();
    getCultivatorRankMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const response = await createApp().request('/api/rankings/challenge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetId: 'target-1',
        realm: '金丹',
      }),
    });

    expect(response.status).toBe(404);
    expect(updateRankingMock).not.toHaveBeenCalled();
  });

  it('adds an unranked loser to the ranking tail when own-realm ranking has vacancies', async () => {
    getCultivatorRankMock.mockReset();
    getCultivatorRankMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(1);
    simulateBattleV5Mock.mockReturnValueOnce({
      winner: { id: 'target-1' },
      loser: { id: 'cultivator-1' },
    });
    addToRankingTailIfVacantMock.mockResolvedValueOnce(2);

    const response = await createApp().request(
      '/api/rankings/challenge-battle/v5',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId: 'target-1',
        }),
      },
    );
    const result = (await response.json()) as {
      data: {
        rankingUpdate: {
          isWin: boolean;
          challengerRank: number | null;
          rankChangeType: string | null;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(result.data.rankingUpdate).toMatchObject({
      isWin: false,
      challengerRank: 2,
      rankChangeType: 'vacancy_entry',
    });
    expect(addToRankingTailIfVacantMock).toHaveBeenCalledWith(
      '筑基',
      'cultivator-1',
    );
    expect(incrementDailyChallengesMock).toHaveBeenCalledTimes(1);
    expect(createBattleRecordV2Mock).toHaveBeenCalledTimes(1);
    expect(recordTaskEventMock).toHaveBeenCalledWith(
      'cultivator-1',
      'ranking_challenge_battled',
      { tx: 'tx' },
    );
    expect(createMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        textContent:
          '万界金榜有感，韩立虽挑战厉飞雨未胜，仍补入筑基天骄榜第2名。',
        payload: {
          text: '万界金榜有感，韩立虽挑战厉飞雨未胜，仍补入筑基天骄榜第2名。',
        },
      }),
    );
  });

  it('does not broadcast when an unranked loser cannot enter a full ranking', async () => {
    getCultivatorRankMock.mockReset();
    getCultivatorRankMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(1);
    simulateBattleV5Mock.mockReturnValueOnce({
      winner: { id: 'target-1' },
      loser: { id: 'cultivator-1' },
    });
    addToRankingTailIfVacantMock.mockResolvedValueOnce(null);

    const response = await createApp().request(
      '/api/rankings/challenge-battle/v5',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId: 'target-1',
        }),
      },
    );
    const result = (await response.json()) as {
      data: {
        rankingUpdate: {
          challengerRank: number | null;
          rankChangeType: string | null;
        };
      };
    };

    expect(response.status).toBe(200);
    expect(result.data.rankingUpdate).toMatchObject({
      challengerRank: null,
      rankChangeType: null,
    });
    expect(createMessageMock).not.toHaveBeenCalled();
  });

  it('keeps ranking challenge successful when world chat broadcast fails', async () => {
    createMessageMock.mockRejectedValueOnce(new Error('redis unavailable'));

    const response = await createApp().request(
      '/api/rankings/challenge-battle/v5',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId: 'target-1',
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(updateRankingMock).toHaveBeenCalledWith(
      '筑基',
      'cultivator-1',
      'target-1',
    );
    expect(createMessageMock).toHaveBeenCalledTimes(1);
  });
});
