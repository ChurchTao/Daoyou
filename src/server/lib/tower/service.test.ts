import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTowerSeasonMeta } from '@shared/lib/tower';
import type { Cultivator } from '@shared/types/cultivator';

const redisStore = new Map<string, string>();

const {
  getCultivatorByIdUnsafeMock,
  loadTowerEnemyForBattleMock,
  simulateBattleV5Mock,
} = vi.hoisted(() => ({
  getCultivatorByIdUnsafeMock: vi.fn(),
  loadTowerEnemyForBattleMock: vi.fn(),
  simulateBattleV5Mock: vi.fn(),
}));

vi.mock('@server/lib/redis', () => ({
  redis: {
    get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      redisStore.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      redisStore.delete(key);
      return 1;
    }),
  },
}));

vi.mock('@server/lib/services/cultivatorService', () => ({
  getCultivatorByIdUnsafe: getCultivatorByIdUnsafeMock,
}));

vi.mock('@server/lib/services/ConditionService', () => ({
  ConditionService: {
    normalizeCondition: vi.fn((_cultivator, condition) => condition),
    getMaxResources: vi.fn(() => ({ maxHp: 100, maxMp: 100 })),
  },
}));

vi.mock('@server/lib/services/simulateBattleV5', () => ({
  simulateBattleV5: simulateBattleV5Mock,
}));

vi.mock('@server/lib/services/MailService', () => ({
  MailService: {
    sendMail: vi.fn(),
  },
}));

vi.mock('@server/lib/dungeon/reward', () => ({
  RewardFactory: {
    generateBaseRewards: vi.fn(() => []),
  },
}));

vi.mock('./enemySets', () => ({
  towerEnemySetService: {
    loadTowerEnemyForBattle: loadTowerEnemyForBattleMock,
  },
}));

import { towerService } from './service';

const condition = {
  version: 1 as const,
  resources: {
    hp: { current: 100 },
    mp: { current: 100 },
  },
  gauges: {
    pillToxicity: 0,
  },
  tracks: {
    tempering: {
      vitality: { level: 0, progress: 0 },
      spirit: { level: 0, progress: 0 },
      wisdom: { level: 0, progress: 0 },
      speed: { level: 0, progress: 0 },
      willpower: { level: 0, progress: 0 },
    },
    marrowWash: { level: 0, progress: 0 },
  },
  counters: {
    longTermPillUsesByRealm: {},
    cultivationPillUsesByRealm: {},
    longevityPillUsesByRealm: {},
  },
  statuses: [],
  timestamps: {},
};

function makeCultivator(realm: Cultivator['realm']): Cultivator {
  return {
    id: 'cultivator-1',
    name: '韩立',
    title: '青元子',
    gender: '男',
    race: '人族',
    realm,
    realm_stage: '初期',
    age: 160,
    lifespan: 900,
    attributes: {
      vitality: 100,
      spirit: 100,
      wisdom: 100,
      speed: 100,
      willpower: 100,
    },
    spiritual_roots: [{ element: '金', strength: 90 }],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: { artifacts: [], consumables: [], materials: [] },
    equipped: { weapon: null, armor: null, accessory: null },
    spirit_stones: 0,
    condition,
    background: '散修',
    description: '散修',
  };
}

function makePreparedEnemy(overrides: { floor?: number; kind?: 'normal' | 'elite' | 'boss' } = {}) {
  const floor = overrides.floor ?? 1;
  const kind = overrides.kind ?? 'normal';
  return {
    floor,
    encounter: {
      floor,
      kind,
      difficulty: 5,
      race: '人族' as const,
      realm: '金丹' as const,
      realmStage: '初期' as const,
      isBoss: kind === 'boss',
    },
    enemy: {
      ...makeCultivator('金丹'),
      id: 'enemy-1',
      name: '预生成守关人',
    },
    generationMeta: {
      variantSeed: 'tower:2026-W22@Asia/Shanghai:金丹:1',
      source: 'llm' as const,
      generatedAt: '2026-06-01T00:00:00.000Z',
    },
  };
}

describe('tower service prepared enemies', () => {
  beforeEach(() => {
    redisStore.clear();
    vi.clearAllMocks();
    getCultivatorByIdUnsafeMock.mockResolvedValue({
      cultivator: makeCultivator('金丹'),
    });
    loadTowerEnemyForBattleMock.mockResolvedValue(makePreparedEnemy());
  });

  it('rejects tower starts below golden core', async () => {
    getCultivatorByIdUnsafeMock.mockResolvedValueOnce({
      cultivator: makeCultivator('筑基'),
    });

    await expect(towerService.startRun('cultivator-1')).rejects.toThrow(
      '蜃楼幻境仅向金丹及以上境界开放',
    );
  });

  it('probes battles from the prepared weekly enemy set', async () => {
    await towerService.startRun('cultivator-1');
    const result = await towerService.probeBattle('cultivator-1');

    expect(loadTowerEnemyForBattleMock).toHaveBeenCalledWith({
      seasonKey: result.season.seasonKey,
      realm: '金丹',
      floor: 1,
    });
    expect(result.enemy.name).toBe('预生成守关人');
    expect(result.state.challengeRealm).toBe('金丹');
  });

  it('backfills challenge realm when reading legacy state', async () => {
    const season = getTowerSeasonMeta();
    redisStore.set(
      'tower:run:cultivator-1',
      JSON.stringify({
        runId: 'run-legacy',
        seasonKey: season.seasonKey,
        status: 'READY',
        currentFloor: 1,
        highestFloorCleared: 0,
        condition,
        blessings: {},
        pendingBlessingChoices: [],
        claimedMilestones: [],
        milestoneRewardLog: [],
      }),
    );

    const result = await towerService.getState(
      'cultivator-1',
      new Date(),
      '金丹',
    );
    const savedState = JSON.parse(redisStore.get('tower:run:cultivator-1')!);

    expect(result.state?.challengeRealm).toBe('金丹');
    expect(savedState.challengeRealm).toBe('金丹');
  });

  it('carries the selected blessing into the next floor battle init', async () => {
    const season = getTowerSeasonMeta();
    redisStore.set(
      'tower:run:cultivator-1',
      JSON.stringify({
        runId: 'run-1',
        seasonKey: season.seasonKey,
        challengeRealm: '金丹',
        status: 'CHOOSING_BLESSING',
        currentFloor: 1,
        highestFloorCleared: 1,
        condition,
        blessings: {},
        pendingBlessingChoices: [
          {
            id: 'vitality_surge',
            name: '体魄澎湃',
            description: '战斗时体魄提升 8%，可叠加至 5 层。',
            currentStacks: 0,
            nextStacks: 1,
            maxStacks: 5,
          },
        ],
        claimedMilestones: [],
        milestoneRewardLog: [],
      }),
    );
    loadTowerEnemyForBattleMock.mockResolvedValueOnce(
      makePreparedEnemy({ floor: 2 }),
    );
    simulateBattleV5Mock.mockReturnValueOnce({
      winner: { id: 'cultivator-1' },
      winnerSnapshot: {
        hp: { current: 80 },
        mp: { current: 70 },
      },
    });

    await towerService.chooseBlessing('cultivator-1', 'vitality_surge');
    const battleContext = await towerService.probeBattle('cultivator-1');
    await towerService.executeBattle(
      'cultivator-1',
      battleContext.battleId,
      new Date(),
      { deferPersistence: true },
    );

    expect(loadTowerEnemyForBattleMock).toHaveBeenCalledWith(
      expect.objectContaining({ floor: 2 }),
    );
    expect(simulateBattleV5Mock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        player: expect.objectContaining({
          modifiers: expect.arrayContaining([
            expect.objectContaining({
              attrType: 'vitality',
              type: 'multiply',
              value: 1.08,
            }),
          ]),
        }),
      }),
    );
  });

  it('adds reputation to milestone rewards', async () => {
    const season = getTowerSeasonMeta();
    const encounter = {
      ...makePreparedEnemy().encounter,
      floor: 5,
      kind: 'elite' as const,
    };
    redisStore.set(
      'tower:run:cultivator-1',
      JSON.stringify({
        runId: 'run-1',
        seasonKey: season.seasonKey,
        challengeRealm: '金丹',
        status: 'WAITING_BATTLE',
        currentFloor: 5,
        highestFloorCleared: 4,
        condition,
        blessings: {},
        pendingBlessingChoices: [],
        claimedMilestones: [],
        milestoneRewardLog: [],
        activeBattleId: 'battle-1',
      }),
    );
    redisStore.set(
      'tower:battle:battle-1',
      JSON.stringify({
        session: {
          battleId: 'battle-1',
          cultivatorId: 'cultivator-1',
          runId: 'run-1',
          seasonKey: season.seasonKey,
          encounter,
        },
        enemyObject: makePreparedEnemy().enemy,
      }),
    );
    simulateBattleV5Mock.mockReturnValueOnce({
      winner: { id: 'cultivator-1' },
      winnerSnapshot: {
        hp: { current: 80 },
        mp: { current: 70 },
      },
    });

    const result = await towerService.executeBattle(
      'cultivator-1',
      'battle-1',
      new Date(),
      { deferPersistence: true },
    );

    expect(result.milestoneReward?.rewards).toEqual(
      expect.arrayContaining([{ type: 'reputation', value: 5 }]),
    );
  });

  it('rejects execution when the cultivator has crossed into a new realm', async () => {
    const season = getTowerSeasonMeta();
    redisStore.set(
      'tower:run:cultivator-1',
      JSON.stringify({
        runId: 'run-1',
        seasonKey: season.seasonKey,
        challengeRealm: '金丹',
        status: 'WAITING_BATTLE',
        currentFloor: 1,
        highestFloorCleared: 0,
        condition,
        blessings: {},
        pendingBlessingChoices: [],
        claimedMilestones: [],
        milestoneRewardLog: [],
        activeBattleId: 'battle-1',
      }),
    );
    redisStore.set(
      'tower:battle:battle-1',
      JSON.stringify({
        session: {
          battleId: 'battle-1',
          cultivatorId: 'cultivator-1',
          runId: 'run-1',
          seasonKey: season.seasonKey,
          encounter: makePreparedEnemy().encounter,
        },
        enemyObject: makePreparedEnemy().enemy,
      }),
    );
    getCultivatorByIdUnsafeMock.mockResolvedValueOnce({
      cultivator: makeCultivator('元婴'),
    });

    await expect(
      towerService.executeBattle('cultivator-1', 'battle-1'),
    ).rejects.toThrow('当前境界已变化，请重开幻境以进入新的境界榜');
    expect(simulateBattleV5Mock).not.toHaveBeenCalled();
  });

  it('backfills challenge realm for legacy waiting battles', async () => {
    const season = getTowerSeasonMeta();
    redisStore.set(
      'tower:run:cultivator-1',
      JSON.stringify({
        runId: 'run-legacy',
        seasonKey: season.seasonKey,
        status: 'WAITING_BATTLE',
        currentFloor: 1,
        highestFloorCleared: 0,
        condition,
        blessings: {},
        pendingBlessingChoices: [],
        claimedMilestones: [],
        milestoneRewardLog: [],
        activeBattleId: 'battle-legacy',
      }),
    );
    redisStore.set(
      'tower:battle:battle-legacy',
      JSON.stringify({
        session: {
          battleId: 'battle-legacy',
          cultivatorId: 'cultivator-1',
          runId: 'run-legacy',
          seasonKey: season.seasonKey,
          encounter: makePreparedEnemy().encounter,
        },
        enemyObject: makePreparedEnemy().enemy,
      }),
    );
    simulateBattleV5Mock.mockImplementationOnce(() => {
      throw new Error('simulated battle reached');
    });

    await expect(
      towerService.executeBattle('cultivator-1', 'battle-legacy'),
    ).rejects.toThrow('simulated battle reached');
    expect(simulateBattleV5Mock).toHaveBeenCalledTimes(1);
  });
});
