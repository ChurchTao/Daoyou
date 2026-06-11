import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  checkDailyChallengesMock,
  isRankingEmptyMock,
  getCultivatorRankMock,
  isProtectedMock,
  acquireChallengeLockMock,
  getCultivatorByIdUnsafeMock,
  simulateBattleV5Mock,
  incrementDailyChallengesMock,
  createBattleRecordV2Mock,
  releaseChallengeLockMock,
  recordTaskEventMock,
  commitPlayerStateMutationMock,
  updateRankingMock,
} = vi.hoisted(() => ({
  checkDailyChallengesMock: vi.fn(),
  isRankingEmptyMock: vi.fn(),
  getCultivatorRankMock: vi.fn(),
  isProtectedMock: vi.fn(),
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
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('user', { id: 'user-1' });
      context.set('cultivator', {
        id: 'cultivator-1',
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
  addToRanking: vi.fn(),
  checkDailyChallenges: checkDailyChallengesMock,
  getCultivatorRank: getCultivatorRankMock,
  getRankingList: vi.fn(),
  getRemainingChallenges: vi.fn(),
  incrementDailyChallenges: incrementDailyChallengesMock,
  isLocked: vi.fn(() => false),
  isProtected: isProtectedMock,
  isRankingEmpty: isRankingEmptyMock,
  releaseChallengeLock: releaseChallengeLockMock,
  updateRanking: updateRankingMock,
}));

vi.mock('@server/lib/repositories/battleRecordV2Repository', () => ({
  createBattleRecordV2: createBattleRecordV2Mock,
}));

vi.mock('@server/lib/services/cultivatorService', () => ({
  getCultivatorByIdUnsafe: getCultivatorByIdUnsafeMock,
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
    getCultivatorRankMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    isProtectedMock.mockResolvedValue(false);
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
});
