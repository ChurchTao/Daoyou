import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cultivator } from '@shared/types/cultivator';
import type {
  BattleSession,
  DungeonOptionCost,
  DungeonState,
  PlayerInfo,
} from './types';
import type { BattleRecord } from '@shared/types/battle';
import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
import type { CultivatorCondition } from '@shared/types/condition';

const {
  buildDraftMock,
  enrichNarrativeMock,
  getMapNodeMock,
  redisSetMock,
  resourceConsumeMock,
  resourceGainMock,
  reserveQiMock,
} = vi.hoisted(() => ({
    buildDraftMock: vi.fn(),
    enrichNarrativeMock: vi.fn(),
    getMapNodeMock: vi.fn(),
    redisSetMock: vi.fn(),
    resourceConsumeMock: vi.fn(),
    resourceGainMock: vi.fn(),
    reserveQiMock: vi.fn(),
  }));

vi.mock('@server/lib/prompts', () => ({
  renderPrompt: vi.fn(),
}));

vi.mock('@server/lib/services/simulateBattleV5', () => ({
  simulateBattleV5: vi.fn(),
}));

vi.mock('@server/utils/aiClient', () => ({
  object: vi.fn(),
}));

vi.mock('@shared/engine/resource/ResourceEngine', () => ({
  resourceEngine: {
    consume: resourceConsumeMock,
    gain: resourceGainMock,
    consumeInTransaction: vi.fn(async () => ({ success: true })),
    gainInTransaction: vi.fn(async () => ({ success: true })),
  },
}));

vi.mock('@shared/engine/enemyGenerator', () => ({
  EnemyGenerator: vi.fn().mockImplementation(function EnemyGeneratorMock() {
    return {
      buildDraft: buildDraftMock,
      enrichNarrative: enrichNarrativeMock,
    };
  }),
}));

vi.mock('@shared/lib/game/mapSystem', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@shared/lib/game/mapSystem')>();
  return {
    ...actual,
    getMapNode: getMapNodeMock,
  };
});

vi.mock('../redis', () => ({
  redis: {
    get: vi.fn(),
    set: redisSetMock,
    del: vi.fn(),
  },
}));

vi.mock('../drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

vi.mock('../services/cultivatorService', () => {
  const getCultivatorByIdUnsafe = vi.fn();

  return {
    getCultivatorByIdUnsafe,
    getPlayerRuntimeCultivatorByIdUnsafe: getCultivatorByIdUnsafe,
    getCultivatorOwnerId: vi.fn(),
    getPaginatedInventoryByType: vi.fn(),
    updateCultivator: vi.fn(),
  };
});

vi.mock('../services/ConditionService', () => ({
  ConditionService: {
    tickNaturalRecovery: vi.fn(),
    previewExternalResourceLoss: vi.fn(),
    applyExternalResourceLoss: vi.fn(),
    addOrStackStatus: vi.fn(),
    buildBattleInit: vi.fn(),
    applyBattleOutcome: vi.fn(),
  },
}));

vi.mock('../services/TaskService', () => ({
  TaskService: {
    recordDungeonCompletion: vi.fn(),
    recordTaskEvent: vi.fn(),
  },
}));

vi.mock('../services/QiService', () => ({
  QiService: {
    reserveQi: reserveQiMock,
    commitReservation: vi.fn(),
    refundReservation: vi.fn(),
  },
}));

vi.mock('./dungeonLimiter', () => ({
  checkDungeonLimit: vi.fn(),
  consumeDungeonLimit: vi.fn(),
}));

import {
  DungeonFlowError,
  DungeonFlowErrorCode,
  DungeonService,
} from './service_v2';
import {
  DungeonSettlementLlmSchema,
  DungeonSettlementSchema,
} from './types';
import { object as objectMock } from '@server/utils/aiClient';
import { renderPrompt } from '@server/lib/prompts';
import {
  getCultivatorByIdUnsafe,
  getCultivatorOwnerId,
  getPaginatedInventoryByType,
  updateCultivator,
} from '../services/cultivatorService';
import { ConditionService } from '../services/ConditionService';
import { getExecutor } from '../drizzle/db';

interface TestableDungeonService {
  createBattleSession(
    cultivatorId: string,
    dungeonStateKey: string,
    battleCost: DungeonOptionCost,
    playerInfo: PlayerInfo,
    dungeonState: DungeonState,
  ): Promise<BattleSession>;
}

function createEnemy(input: {
  realm: Cultivator['realm'];
  realmStage: Cultivator['realm_stage'];
  name?: string;
}): Cultivator {
  return {
    id: 'enemy-1',
    name: input.name ?? '测试敌人',
    title: null,
    gender: '男',
    realm: input.realm,
    realm_stage: input.realmStage,
    age: 100,
    lifespan: 300,
    attributes: {
      vitality: 10,
      spirit: 10,
      wisdom: 10,
      speed: 10,
      willpower: 10,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
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
    spirit_stones: 0,
    background: '',
  };
}

function createPlayerInfo(): PlayerInfo {
  return {
    name: '韩立',
    realm: '元婴 后期',
    gender: '男',
    age: 120,
    lifespan: 800,
    personality: '谨慎',
    attributes: {
      vitality: 100,
      spirit: 100,
      wisdom: 100,
      speed: 100,
      willpower: 100,
    },
    resourceCaps: {
      maxHp: 1000,
      maxMp: 800,
    },
    spiritual_roots: [],
    fates: [],
    skills: [],
    spirit_stones: 0,
    background: '',
  };
}

function createDungeonState(mapNodeId: string): DungeonState {
  return {
    cultivatorId: 'cultivator-1',
    mapNodeId,
    playerInfo: createPlayerInfo(),
    theme: '测试秘境',
    currentRound: 1,
    maxRounds: 5,
    history: [],
    status: 'EXPLORING',
    dangerScore: 10,
    isFinished: false,
    location: {
      location: '测试秘境',
      location_tags: [],
      location_description: '',
    },
    summary_of_sacrifice: [],
    accumulatedRewards: [],
    accumulatedHpLoss: 0,
    accumulatedMpLoss: 0,
  };
}

function createBattleCost(value: number): DungeonOptionCost {
  return {
    type: 'battle',
    value,
    metadata: {
      race: '鬼魂',
      realm_stage: '后期',
      enemy_name: '守陵阴魂',
      is_boss: true,
    },
  };
}

function createRound(scene = '你继续深入秘境。') {
  return {
    scene_description: scene,
    interaction: {
      options: [
        {
          id: 1,
          text: '继续探查',
          risk_level: 'low' as const,
          potential_cost: '无',
          costs: [],
        },
      ],
    },
    status_update: {
      is_final_round: false,
      internal_danger_score: 12,
    },
  };
}

function createBattleSnapshot(input: {
  id: string;
  name: string;
  hp: number;
  mp: number;
}): UnitStateSnapshot {
  return {
    id: input.id,
    name: input.name,
    alive: input.hp > 0,
    hp: { current: input.hp, max: 1000, percent: input.hp / 1000 },
    mp: { current: input.mp, max: 800, percent: input.mp / 800 },
    shield: 0,
    attrs: {
      spirit: 100,
      vitality: 100,
      speed: 100,
      willpower: 100,
      wisdom: 100,
      atk: 0,
      def: 0,
      magicAtk: 0,
      magicDef: 0,
      critRate: 0,
      critDamageMult: 1,
      evasionRate: 0,
      controlHit: 0,
      controlResistance: 0,
      armorPenetration: 0,
      magicPenetration: 0,
      critResist: 0,
      critDamageReduction: 0,
      accuracy: 0,
      healAmplify: 0,
      maxHp: 1000,
      maxMp: 800,
    },
    baseAttrs: {
      spirit: 100,
      vitality: 100,
      speed: 100,
      willpower: 100,
      wisdom: 100,
      atk: 0,
      def: 0,
      magicAtk: 0,
      magicDef: 0,
      critRate: 0,
      critDamageMult: 1,
      evasionRate: 0,
      controlHit: 0,
      controlResistance: 0,
      armorPenetration: 0,
      magicPenetration: 0,
      critResist: 0,
      critDamageReduction: 0,
      accuracy: 0,
      healAmplify: 0,
      maxHp: 1000,
      maxMp: 800,
    },
    buffs: [],
    cooldowns: [],
    canAct: input.hp > 0,
  };
}

function createBattleRecord(args: {
  winner: Cultivator;
  loser: Cultivator;
  winnerSnapshot: UnitStateSnapshot;
  loserSnapshot?: UnitStateSnapshot;
}): BattleRecord {
  return {
    winner: args.winner,
    loser: args.loser,
    logs: [],
    turns: 3,
    player: args.winner.id ?? args.winner.name,
    opponent: args.loser.id ?? args.loser.name,
    logSpans: [],
    stateTimeline: {
      frames: [],
      unitIds: [
        args.winner.id ?? args.winner.name,
        args.loser.id ?? args.loser.name,
      ],
      unitNames: {
        [args.winner.id ?? args.winner.name]: args.winner.name,
        [args.loser.id ?? args.loser.name]: args.loser.name,
      },
    },
    winnerSnapshot: args.winnerSnapshot,
    loserSnapshot: args.loserSnapshot,
  };
}

function createSettlement() {
  return {
    ending_narrative: '你带着秘境所得安然离去。',
    settlement: {
      reward_tier: 'C' as const,
      reward_blueprints: [
        {
          name: '青木灵草',
          description: '一株带着青木灵气的草药。',
          material_type: 'herb' as const,
          element: '木' as const,
          reward_score: 30,
        },
      ],
      performance_tags: ['稳妥收获'],
    },
  };
}

function createRewardBlueprint(name: string, reward_score: number) {
  return {
    name,
    description: `${name}的描述`,
    material_type: 'herb' as const,
    element: '木' as const,
    reward_score,
  };
}

function createEmptySettlement() {
  return {
    ending_narrative: '你狼狈退出秘境，此行并无实际收获。',
    settlement: {
      reward_tier: 'D' as const,
      reward_blueprints: [],
      performance_tags: ['空手而归'],
    },
  };
}

describe('DungeonService prompt boundaries', () => {
  it('does not instruct dungeon rounds to generate body cultivation materials', () => {
    vi.mocked(renderPrompt).mockReturnValue({
      system: 'round system',
      user: 'round user',
    });

    const prompt = (new DungeonService() as unknown as { getSystemPrompt(): string })
      .getSystemPrompt();

    expect(prompt).not.toContain('炼体材料');
    expect(prompt).not.toContain('服务端会归一');
  });
});

describe('DungeonService dungeon enemy difficulty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisSetMock.mockResolvedValue('OK');
    buildDraftMock.mockImplementation((input) => ({
      cultivator: createEnemy({
        realm: input.realm,
        realmStage: input.realmStage,
        name: input.name,
      }),
    }));
    enrichNarrativeMock.mockImplementation(async (draft) => draft);
  });

  it('uses table difficulty and stage clamp instead of LLM battle value', async () => {
    getMapNodeMock.mockReturnValueOnce({
      id: 'easy-map',
      name: '太岳山脉',
      region: '天南',
      realm_requirement: '筑基',
      dungeon_config: { difficulty: 'easy' },
      tags: [],
      description: '',
      connections: [],
      x: 0,
      y: 0,
    });
    const service = new DungeonService() as unknown as TestableDungeonService;

    const session = await service.createBattleSession(
      'cultivator-1',
      'dungeon:active:cultivator-1',
      createBattleCost(100),
      createPlayerInfo(),
      createDungeonState('easy-map'),
    );

    expect(buildDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        realm: '筑基',
        realmStage: '初期',
        difficulty: 12,
        isBoss: false,
      }),
    );
    expect(enrichNarrativeMock).toHaveBeenCalledTimes(1);
    expect(session.enemyData).toMatchObject({
      realm: '筑基',
      stage: '初期',
      difficulty: 12,
    });
  });

  it('allows boss loadout only on boss maps and uses fixed table difficulty', async () => {
    getMapNodeMock.mockReturnValueOnce({
      id: 'boss-map',
      name: '昆吾山',
      region: '大晋',
      realm_requirement: '化神',
      dungeon_config: { difficulty: 'boss' },
      tags: [],
      description: '',
      connections: [],
      x: 0,
      y: 0,
    });
    const service = new DungeonService() as unknown as TestableDungeonService;

    const session = await service.createBattleSession(
      'cultivator-1',
      'dungeon:active:cultivator-1',
      createBattleCost(200),
      createPlayerInfo(),
      createDungeonState('boss-map'),
    );

    expect(buildDraftMock).toHaveBeenCalledWith(
      expect.objectContaining({
        realm: '化神',
        realmStage: '圆满',
        difficulty: 90,
        isBoss: true,
      }),
    );
    expect(enrichNarrativeMock).toHaveBeenCalledTimes(1);
    expect(session.enemyData).toMatchObject({
      realm: '化神',
      stage: '圆满',
      difficulty: 90,
    });
  });
});

describe('DungeonService dungeon start eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisSetMock.mockResolvedValue('OK');
  });

  it('rejects dungeon starts above the player realm before reserving qi', async () => {
    vi.mocked(getExecutor).mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => []),
            })),
          })),
        })),
      })),
    } as unknown as ReturnType<typeof getExecutor>);
    getMapNodeMock.mockReturnValueOnce({
      id: 'SAT_TN_01',
      name: '太岳山·无名古修士洞府',
      parent_id: 'TN_YUE_01',
      type: '隐秘地点',
      realm_requirement: '筑基',
      tags: [],
      description: '',
      connections: [],
      x: 82,
      y: 88,
      dungeon_config: { difficulty: 'normal' },
    });
    const service = new DungeonService();
    vi.spyOn(service, 'getPlayer').mockResolvedValueOnce({
      ...createPlayerInfo(),
      realm: '炼气 后期',
    } as unknown as Awaited<ReturnType<DungeonService['getPlayer']>>);

    await expect(
      service.startDungeon('cultivator-1', 'SAT_TN_01'),
    ).rejects.toThrow('当前境界炼气不可挑战筑基副本，请先提升大境界');
    expect(reserveQiMock).not.toHaveBeenCalled();
  });
});

describe('DungeonService action recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisSetMock.mockResolvedValue('OK');
    resourceConsumeMock.mockResolvedValue({ success: true });
    vi.mocked(getCultivatorOwnerId).mockResolvedValue('user-1');
    vi.mocked(getCultivatorByIdUnsafe).mockResolvedValue({
      cultivator: createEnemy({
        realm: '元婴',
        realmStage: '后期',
        name: '韩立',
      }),
    } as Awaited<ReturnType<typeof getCultivatorByIdUnsafe>>);
    getMapNodeMock.mockReturnValue({
      id: 'easy-map',
      name: '太岳山脉',
      region: '天南',
      realm_requirement: '筑基',
      dungeon_config: { difficulty: 'easy' },
      tags: [],
      description: '',
      connections: [],
      x: 0,
      y: 0,
    });
  });

  it('returns recoverable state when regular next-round LLM generation fails', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.currentRound = 2;
    state.currentOptions = [
      {
        id: 1,
        text: '探查石门',
        risk_level: 'medium',
        potential_cost: '可能惊动禁制',
        costs: [],
      },
    ];
    state.history.push({
      round: 2,
      scene: '石门之后传来低沉回响。',
    });
    vi.spyOn(service, 'getState').mockResolvedValueOnce(state);
    vi.spyOn(service as any, 'callAI').mockRejectedValueOnce(
      new Error('round LLM down'),
    );
    vi.spyOn(service, 'saveState').mockResolvedValue();

    const result = await service.handleAction(
      'cultivator-1',
      1,
      'action-1',
    );

    expect(result).toMatchObject({
      actionId: 'action-1',
      isFinished: false,
      state: {
        status: 'RECOVERABLE_ERROR',
        currentRound: 2,
        statusReason: 'round LLM down',
        pendingAction: {
          actionId: 'action-1',
          status: 'failed',
        },
        recoverableActions: ['retry', 'safe_retreat', 'force_quit'],
      },
    });
  });

  it('returns recoverable state when battle enemy generation fails', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.currentOptions = [
      {
        id: 1,
        text: '踏入阴影',
        risk_level: 'high',
        potential_cost: '遭遇守陵阴魂',
        costs: [createBattleCost(80)],
      },
    ];
    state.history.push({
      round: 1,
      scene: '阴影深处浮现一座破碎祭台。',
    });
    vi.spyOn(service, 'getState').mockResolvedValueOnce(state);
    enrichNarrativeMock.mockRejectedValueOnce(new Error('enemy LLM down'));
    vi.spyOn(service, 'saveState').mockResolvedValue();

    const result = await service.handleAction(
      'cultivator-1',
      1,
      'battle-action-1',
    );

    expect(result).toMatchObject({
      actionId: 'battle-action-1',
      isFinished: false,
      state: {
        status: 'RECOVERABLE_ERROR',
        statusReason: 'enemy LLM down',
        pendingAction: {
          actionId: 'battle-action-1',
          status: 'failed',
        },
        recoverableActions: ['retry', 'safe_retreat', 'force_quit'],
      },
    });
    expect(result.state?.activeBattleId).toBeUndefined();
  });

  it('persists hp and mp loss costs when committing a regular dungeon action', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.currentOptions = [
      {
        id: 1,
        text: '强行穿过禁制',
        risk_level: 'medium',
        potential_cost: '气血与法力受损',
        costs: [
          { type: 'hp_loss', value: 0.2 },
          { type: 'mp_loss', value: 0.15 },
        ],
      },
    ];
    state.history.push({
      round: 1,
      scene: '禁制横在甬道之前。',
    });
    const player = createEnemy({
      realm: '元婴',
      realmStage: '后期',
      name: '韩立',
    });
    player.id = 'cultivator-1';
    const nextCondition = {
      version: 1,
      resources: {
        hp: { current: 800 },
        mp: { current: 680 },
      },
      gauges: { pillToxicity: 0 },
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
      timestamps: {
        lastRecoveryAt: new Date().toISOString(),
      },
      metrics: {
        totalRecoveredHp: 0,
        totalRecoveredMp: 0,
      },
    } satisfies CultivatorCondition;
    const tx = { tx: true };
    resourceConsumeMock.mockImplementation(
      async (_userId, _cultivatorId, _costs, action, dryRun) => {
        if (!dryRun && action) {
          await action(tx);
        }
        return { success: true, operations: _costs };
      },
    );
    vi.mocked(getCultivatorByIdUnsafe).mockResolvedValue({
      cultivator: player,
      userId: 'user-1',
      updatedAt: new Date(),
    });
    vi.mocked(ConditionService.previewExternalResourceLoss).mockReturnValueOnce({
      maxHp: 1_000,
      maxMp: 800,
      rawHpLoss: 200,
      rawMpLoss: 120,
      hpLoss: 180,
      mpLoss: 108,
      preventedHpLoss: 20,
      preventedMpLoss: 12,
      hpLossMultiplier: 0.9,
      mpLossMultiplier: 0.9,
      triggerTexts: [
        '肉身炼体生效：外护与承压降低气血损耗 20 点',
        '肉身炼体生效：气血与元神稳住灵力损耗 12 点',
      ],
    });
    vi.mocked(ConditionService.applyExternalResourceLoss).mockReturnValueOnce(
      nextCondition,
    );
    vi.mocked(updateCultivator).mockResolvedValueOnce(player);
    vi.spyOn(service, 'getState').mockResolvedValueOnce(state);
    vi.spyOn(service as any, 'callAI').mockResolvedValueOnce(
      createRound('穿过禁制后，你来到一片幽暗石室。'),
    );
    vi.spyOn(service, 'saveState').mockResolvedValue();

    const result = await service.handleAction(
      'cultivator-1',
      1,
      'cost-action-1',
    );

    expect(result).toMatchObject({
      actionId: 'cost-action-1',
      isFinished: false,
      state: {
        accumulatedHpLoss: 0.2,
        accumulatedMpLoss: 0.15,
        status: 'EXPLORING',
        costLedger: [
          {
            costs: [
              {
                type: 'hp_loss',
                metadata: {
                  bodyCultivation: {
                    eventType: 'generic',
                    preventedLoss: 20,
                    track: 'skin',
                    trackLabel: '皮肤',
                    triggerText:
                      '肉身炼体生效：外护与承压降低气血损耗 20 点',
                  },
                },
              },
              {
                type: 'mp_loss',
                metadata: {
                  bodyCultivation: {
                    eventType: 'generic',
                    preventedLoss: 12,
                    track: 'primordial_spirit',
                    trackLabel: '元神',
                    triggerText:
                      '肉身炼体生效：气血与元神稳住灵力损耗 12 点',
                  },
                },
              },
            ],
          },
        ],
      },
    });
    expect(ConditionService.previewExternalResourceLoss).toHaveBeenCalledWith(
      player,
      player.condition,
      {
        hpPercent: 0.2,
        mpPercent: 0.15,
      },
    );
    expect(ConditionService.applyExternalResourceLoss).toHaveBeenCalledWith(
      player,
      player.condition,
      {
        hpPercent: 0.2,
        mpPercent: 0.15,
      },
    );
    expect(updateCultivator).toHaveBeenCalledWith(
      'cultivator-1',
      { condition: nextCondition },
      tx,
    );
  });

  it('previews body cultivation resource-loss feedback on generated dungeon options', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.currentOptions = [
      {
        id: 1,
        text: '绕过石门',
        risk_level: 'low',
        potential_cost: '继续探索',
        costs: [],
      },
    ];
    state.history.push({
      round: 1,
      scene: '石门之后传来低沉回响。',
    });
    const player = createEnemy({
      realm: '元婴',
      realmStage: '后期',
      name: '韩立',
    });
    player.id = 'cultivator-1';
    vi.mocked(getCultivatorByIdUnsafe).mockResolvedValue({
      cultivator: player,
      userId: 'user-1',
      updatedAt: new Date(),
    });
    vi.mocked(ConditionService.previewExternalResourceLoss)
      .mockReturnValueOnce({
        maxHp: 1_000,
        maxMp: 800,
        rawHpLoss: 100,
        rawMpLoss: 80,
        hpLoss: 90,
        mpLoss: 72,
        preventedHpLoss: 10,
        preventedMpLoss: 8,
        hpLossMultiplier: 0.9,
        mpLossMultiplier: 0.9,
        triggerTexts: [
          '肉身炼体生效：外护与承压降低气血损耗 10 点',
          '肉身炼体生效：气血与元神稳住灵力损耗 8 点',
        ],
      })
      .mockReturnValueOnce({
        maxHp: 1_000,
        maxMp: 800,
        rawHpLoss: 0,
        rawMpLoss: 0,
        hpLoss: 0,
        mpLoss: 0,
        preventedHpLoss: 0,
        preventedMpLoss: 0,
        hpLossMultiplier: 1,
        mpLossMultiplier: 1,
        triggerTexts: [],
      });
    vi.spyOn(service, 'getState').mockResolvedValueOnce(state);
    vi.spyOn(service as any, 'callAI').mockResolvedValueOnce({
      ...createRound('禁制后的甬道泛起青光。'),
      interaction: {
        options: [
          {
            id: 1,
            text: '强行穿过毒瘴幻境',
            risk_level: 'medium' as const,
            potential_cost: '毒瘴侵蚀皮膜，幻境牵动识海',
            costs: [
              { type: 'hp_loss' as const, value: 0.1 },
              { type: 'mp_loss' as const, value: 0.1 },
            ],
          },
          {
            id: 2,
            text: '原地调息',
            risk_level: 'low' as const,
            potential_cost: '无',
            costs: [],
          },
          {
            id: 3,
            text: '折返探查',
            risk_level: 'low' as const,
            potential_cost: '无',
            costs: [],
          },
        ],
      },
    });
    vi.spyOn(service, 'saveState').mockResolvedValue();

    const result = await service.handleAction(
      'cultivator-1',
      1,
      'preview-action-1',
    );

    expect(result.state).toBeDefined();
    const resultState = result.state as DungeonState;
    expect(resultState.currentOptions?.[0].costPreview).toEqual([
      {
        type: 'hp_loss',
        value: 0.1,
        metadata: {
          bodyCultivation: {
            rawLoss: 100,
            actualLoss: 90,
            preventedLoss: 10,
            multiplier: 0.9,
            eventType: 'erosion',
            track: 'skin',
            trackLabel: '皮肤',
            triggerText: '皮肤生效：降低外邪侵蚀，已抵消 10 点气血损耗',
          },
        },
      },
      {
        type: 'mp_loss',
        value: 0.1,
        metadata: {
          bodyCultivation: {
            rawLoss: 80,
            actualLoss: 72,
            preventedLoss: 8,
            multiplier: 0.9,
            eventType: 'spirit_intrusion',
            track: 'primordial_spirit',
            trackLabel: '元神',
            triggerText: '元神生效：降低神魂侵蚀，已抵消 8 点灵力损耗',
          },
        },
      },
    ]);
    expect(ConditionService.previewExternalResourceLoss).toHaveBeenCalledWith(
      player,
      player.condition,
      {
        hpPercent: 0.1,
        mpPercent: 0.1,
      },
    );
  });

  it('matches dungeon material costs from lowest acceptable quality first', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.currentOptions = [
      {
        id: 1,
        text: '以灵草试探禁制',
        risk_level: 'medium',
        potential_cost: '消耗一株灵草',
        costs: [
          {
            type: 'material',
            value: 1,
            required_type: 'herb',
            required_quality: '灵品',
          },
        ],
      },
    ];
    state.history.push({
      round: 1,
      scene: '禁制前草木灵机涌动。',
    });
    vi.mocked(getPaginatedInventoryByType).mockResolvedValue({
      type: 'materials',
      items: [
        {
          id: 'low-material',
          name: '低品灵草',
          type: 'herb',
          rank: '灵品',
          quantity: 1,
        },
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 1,
        totalPages: 1,
        hasMore: false,
      },
    } as Awaited<ReturnType<typeof getPaginatedInventoryByType>>);
    vi.spyOn(service, 'getState').mockResolvedValueOnce(state);
    vi.spyOn(service as any, 'callAI').mockResolvedValueOnce(
      createRound('灵草化作微光，禁制随之散开。'),
    );
    vi.spyOn(service, 'saveState').mockResolvedValue();

    await service.handleAction('cultivator-1', 1, 'material-action-1');

    expect(getPaginatedInventoryByType).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      expect.objectContaining({
        type: 'materials',
        materialTypes: ['herb'],
        materialRanks: expect.arrayContaining(['灵品', '真品', '地品']),
        materialSortBy: 'rank',
        materialSortOrder: 'asc',
      }),
    );
    expect(resourceConsumeMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      [
        expect.objectContaining({
          type: 'material',
          name: '低品灵草',
          value: 1,
        }),
      ],
      undefined,
      true,
    );
  });
});

describe('DungeonService option fallback', () => {
  it('repairs an exploring final round with no options so the player can settle', () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.currentRound = 5;
    state.maxRounds = 5;
    state.status = 'EXPLORING';
    state.currentOptions = [];

    const normalized = (service as any).normalizeState(state) as DungeonState;

    expect(normalized.currentOptions).toEqual([
      expect.objectContaining({
        id: 1,
        risk_level: 'low',
        costs: [],
        costPreview: [],
      }),
    ]);
    expect(normalized.currentOptions?.[0].text).toContain('结束探索');
  });

  it('adds a continuation fallback when AI returns no options before the final round', () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.currentRound = 3;
    state.maxRounds = 5;
    const round = createRound('空荡甬道向前延伸。');
    round.interaction.options = [];

    const normalized = (service as any).normalizeRoundOptions(
      round,
      state,
    ) as ReturnType<typeof createRound>;

    expect(normalized.interaction.options).toEqual([
      expect.objectContaining({
        id: 1,
        risk_level: 'low',
        costs: [],
        costPreview: [],
      }),
    ]);
    expect(normalized.interaction.options[0].text).toContain('继续探索');
  });
});

describe('DungeonService battle condition persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisSetMock.mockResolvedValue('OK');
  });

  it('persists player hp and mp from the dungeon battle result', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.history.push({
      round: 1,
      scene: '守陵阴魂自雾中现身。',
    });
    const player = createEnemy({
      realm: '元婴',
      realmStage: '后期',
      name: '韩立',
    });
    player.id = 'cultivator-1';
    const enemy = createEnemy({
      realm: '筑基',
      realmStage: '后期',
      name: '守陵阴魂',
    });
    const winnerSnapshot = createBattleSnapshot({
      id: 'cultivator-1',
      name: '韩立',
      hp: 456,
      mp: 123,
    });
    const nextCondition = {
      version: 1,
      resources: {
        hp: { current: 456 },
        mp: { current: 123 },
      },
      gauges: { pillToxicity: 0 },
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
      timestamps: {
        lastRecoveryAt: new Date().toISOString(),
      },
      metrics: {
        totalRecoveredHp: 0,
        totalRecoveredMp: 0,
      },
    } satisfies CultivatorCondition;
    vi.mocked(ConditionService.applyBattleOutcome).mockReturnValueOnce(
      nextCondition,
    );
    vi.mocked(updateCultivator).mockResolvedValueOnce(player);
    vi.spyOn(service, 'getState').mockResolvedValueOnce(state);
    vi.spyOn(service, 'saveState').mockResolvedValueOnce();

    const result = await service.handleBattleCallback(
      'cultivator-1',
      createBattleRecord({
        winner: player,
        loser: enemy,
        winnerSnapshot,
        loserSnapshot: createBattleSnapshot({
          id: 'enemy-1',
          name: '守陵阴魂',
          hp: 0,
          mp: 50,
        }),
      }),
      player,
    );

    expect(result).toMatchObject({
      isFinished: false,
      state: {
        status: 'LOOTING',
      },
    });
    expect(result.state?.activeBattleId).toBeUndefined();
    expect(ConditionService.applyBattleOutcome).toHaveBeenCalledWith(
      player,
      player.condition,
      winnerSnapshot,
      'persistent_pve',
      false,
    );
    expect(updateCultivator).toHaveBeenCalledWith('cultivator-1', {
      condition: nextCondition,
    });
  });
});

describe('DungeonService looting continuation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisSetMock.mockResolvedValue('OK');
    resourceConsumeMock.mockResolvedValue({ success: true });
    resourceGainMock.mockResolvedValue({ success: true });
    vi.mocked(renderPrompt).mockReturnValue({
      system: 'settlement system',
      user: 'settlement user',
    });
    vi.mocked(getCultivatorOwnerId).mockResolvedValue('user-1');
    getMapNodeMock.mockReturnValue({
      id: 'easy-map',
      name: '太岳山脉',
      region: '天南',
      realm_requirement: '筑基',
      dungeon_config: { difficulty: 'easy' },
      tags: [],
      description: '',
      connections: [],
      x: 0,
      y: 0,
    });
  });

  it('throws a flow error when continuing outside LOOTING state', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.status = 'EXPLORING';
    vi.spyOn(service, 'getState').mockResolvedValueOnce(state);

    const promise = service.continueFromLooting('cultivator-1');

    await expect(promise).rejects.toMatchObject({
      code: DungeonFlowErrorCode.INVALID_STATE,
      message: '当前副本状态已变化，请刷新后重试',
      status: 409,
    });
    await expect(promise).rejects.toBeInstanceOf(DungeonFlowError);
  });

  it('settles when continuing from LOOTING past the max round', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.status = 'LOOTING';
    state.currentRound = 5;
    state.maxRounds = 5;
    const settlementResult: Awaited<
      ReturnType<DungeonService['settleDungeon']>
    > = {
      isFinished: true,
      settlement: {
        ending_narrative: '秘境探索结束。',
        settlement: {
          reward_tier: 'C',
          reward_blueprints: [],
          performance_tags: [],
        },
      },
      realGains: [],
    };
    vi.spyOn(service, 'getState').mockResolvedValueOnce(state);
    const settleSpy = vi
      .spyOn(service, 'settleDungeon')
      .mockResolvedValueOnce(settlementResult);

    await expect(service.continueFromLooting('cultivator-1')).resolves.toBe(
      settlementResult,
    );
    expect(settleSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'GENERATING_NEXT',
        currentRound: 6,
        maxRounds: 5,
      }),
      { deferPersistence: undefined },
    );
  });

  it('enters recoverable retry_continue when AI generation fails after looting', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.status = 'LOOTING';
    state.currentRound = 2;
    state.maxRounds = 5;
    state.history.push({
      round: 2,
      scene: '你击败了守陵阴魂。',
      outcome: '战斗胜利。',
    });
    vi.spyOn(service, 'getState').mockResolvedValueOnce(state);
    vi.spyOn(service as any, 'callAI').mockRejectedValueOnce(
      new Error('LLM unavailable'),
    );
    const saveSpy = vi.spyOn(service, 'saveState').mockResolvedValueOnce();

    const result = await service.continueFromLooting('cultivator-1');

    expect(result.isFinished).toBe(false);
    expect(result.state).toMatchObject({
      status: 'RECOVERABLE_ERROR',
      currentRound: 3,
      statusReason: 'LLM unavailable',
      recoverableActions: ['retry_continue', 'safe_retreat', 'force_quit'],
    });
    expect(saveSpy).toHaveBeenCalledWith('cultivator-1', result.state);
  });

  it('retries a failed looting continuation without incrementing the round again', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.status = 'RECOVERABLE_ERROR';
    state.currentRound = 3;
    state.maxRounds = 5;
    state.recoverableActions = ['retry_continue', 'safe_retreat', 'force_quit'];
    vi.spyOn(service, 'getState').mockResolvedValueOnce(state);
    vi.spyOn(service as any, 'callAI').mockResolvedValueOnce(
      createRound('重试后，秘境深处云雾散开。'),
    );
    vi.spyOn(service, 'saveState').mockResolvedValueOnce();

    const result = await service.recoverDungeon(
      'cultivator-1',
      'retry_continue',
    );

    expect(result).toMatchObject({
      isFinished: false,
      state: {
        status: 'EXPLORING',
        currentRound: 3,
      },
      roundData: {
        scene_description: '重试后，秘境深处云雾散开。',
      },
    });
  });

  it('enters retry_settle when final looting continuation settlement LLM fails', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.status = 'LOOTING';
    state.currentRound = 5;
    state.maxRounds = 5;
    vi.spyOn(service, 'getState').mockResolvedValueOnce(state);
    vi.spyOn(service, 'saveState').mockResolvedValue();
    vi.mocked(objectMock).mockRejectedValueOnce(new Error('settlement LLM down'));

    const result = await service.continueFromLooting('cultivator-1');

    expect(result.isFinished).toBe(false);
    expect(result.state).toMatchObject({
      status: 'RECOVERABLE_ERROR',
      currentRound: 6,
      statusReason: 'settlement LLM down',
      recoverableActions: ['retry_settle', 'force_quit'],
    });
  });

  it('settles successfully when the LLM returns no reward blueprints', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.status = 'SETTLING';
    const emptySettlement = createEmptySettlement();
    vi.spyOn(service, 'saveState').mockResolvedValue();
    const archiveSpy = vi.spyOn(service, 'archiveDungeon').mockResolvedValue();
    vi.mocked(objectMock).mockResolvedValueOnce({
      object: emptySettlement,
    } as Awaited<ReturnType<typeof objectMock>>);

    const result = await service.settleDungeon(state, {
      endDisposition: 'retreated_after_battle',
    });

    expect(DungeonSettlementSchema.safeParse(emptySettlement).success).toBe(
      true,
    );
    expect(DungeonSettlementLlmSchema.safeParse(emptySettlement).success).toBe(
      true,
    );
    expect(result).toMatchObject({
      isFinished: true,
      settlement: emptySettlement,
    });
    expect(result.realGains).toEqual(expect.any(Array));
    expect(resourceGainMock).toHaveBeenCalled();
    expect(archiveSpy).toHaveBeenCalledWith(
      state,
      emptySettlement,
      result.realGains,
    );
  });

  it('normalizes overfull accumulated rewards before settlement payout', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.status = 'SETTLING';
    state.accumulatedRewards = [
      createRewardBlueprint('一号灵草', 10),
      createRewardBlueprint('二号灵草', 20),
      createRewardBlueprint('三号灵草', 30),
      createRewardBlueprint('四号灵草', 40),
      createRewardBlueprint('五号灵草', 50),
      createRewardBlueprint('六号灵草', 60),
    ];
    const overfullSettlement = {
      ending_narrative: '你带着秘境所得离去。',
      settlement: {
        reward_tier: 'S' as const,
        reward_blueprints: [
          ...state.accumulatedRewards,
          createRewardBlueprint('额外灵草', 90),
        ],
        performance_tags: ['收获颇丰'],
      },
    };
    vi.spyOn(service, 'saveState').mockResolvedValue();
    const archiveSpy = vi.spyOn(service, 'archiveDungeon').mockResolvedValue();
    vi.mocked(objectMock).mockResolvedValueOnce({
      object: overfullSettlement,
    } as Awaited<ReturnType<typeof objectMock>>);

    const result = await service.settleDungeon(state);
    const objectOptions = vi.mocked(objectMock).mock.calls[0]?.[2];

    expect(DungeonSettlementSchema.safeParse(overfullSettlement).success).toBe(
      false,
    );
    expect(objectOptions?.schema.safeParse(overfullSettlement).success).toBe(
      true,
    );
    expect(result.settlement?.settlement.reward_blueprints).toHaveLength(5);
    expect(
      result.settlement?.settlement.reward_blueprints.map((item) => item.name),
    ).toEqual(['二号灵草', '三号灵草', '四号灵草', '五号灵草', '六号灵草']);
    expect(DungeonSettlementSchema.safeParse(result.settlement).success).toBe(
      true,
    );
    expect(renderPrompt).toHaveBeenCalledWith(
      'dungeon-settlement',
      expect.objectContaining({
        settlementContextJson: expect.stringContaining(
          '"remainingExtraRewardSlots":0',
        ),
      }),
    );
    expect(archiveSpy).toHaveBeenCalledWith(
      state,
      result.settlement,
      result.realGains,
    );
  });

  it('does not return successful settlement when reward gain fails', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.status = 'SETTLING';
    vi.spyOn(service, 'saveState').mockResolvedValue();
    vi.mocked(objectMock).mockResolvedValueOnce({
      object: createSettlement(),
    } as Awaited<ReturnType<typeof objectMock>>);
    resourceGainMock.mockResolvedValueOnce({
      success: false,
      errors: ['奖励发放失败'],
    });

    const result = await service.settleDungeon(state);

    expect(result).toMatchObject({
      isFinished: false,
      state: {
        status: 'RECOVERABLE_ERROR',
        statusReason: '奖励发放失败',
        recoverableActions: ['retry_settle', 'force_quit'],
      },
    });
    expect(result.settlement).toBeUndefined();
  });

  it('keeps final-round pending action costs retryable instead of skipping to retry_settle', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.status = 'SETTLING';
    state.currentRound = 5;
    state.maxRounds = 5;
    const pendingAction = {
      actionId: 'action-1',
      choiceId: 1,
      choiceText: '强取灵材',
      round: 5,
      status: 'pending' as const,
      costs: [{ type: 'spirit_stones' as const, value: 10 }],
      createdAt: new Date(0).toISOString(),
    };
    vi.spyOn(service, 'saveState').mockResolvedValue();
    vi.mocked(objectMock).mockResolvedValueOnce({
      object: createSettlement(),
    } as Awaited<ReturnType<typeof objectMock>>);
    resourceConsumeMock.mockResolvedValueOnce({
      success: false,
      errors: ['灵石不足'],
    });

    const result = await service.settleDungeon(state, { pendingAction });

    expect(result).toMatchObject({
      isFinished: false,
      state: {
        status: 'RECOVERABLE_ERROR',
        statusReason: '灵石不足',
        pendingAction: {
          actionId: 'action-1',
          status: 'failed',
          error: '灵石不足',
        },
        recoverableActions: ['retry', 'safe_retreat', 'force_quit'],
      },
    });
    expect(result.state?.settlement).toBeUndefined();
    expect(resourceGainMock).not.toHaveBeenCalled();
  });

  it('retries settlement from saved settlement gains without rerunning LLM or rewards', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    const gains = [{ type: 'spirit_stones' as const, value: 10 }];
    state.status = 'RECOVERABLE_ERROR';
    state.recoverableActions = ['retry_settle', 'force_quit'];
    state.settlement = createSettlement();
    state.realGains = gains;
    state.gainLedger = [
      {
        source: 'settlement',
        gains,
        committedAt: new Date(0).toISOString(),
      },
    ];
    vi.spyOn(service, 'getState').mockResolvedValueOnce(state);
    vi.spyOn(service, 'saveState').mockResolvedValue();
    const archiveSpy = vi.spyOn(service, 'archiveDungeon').mockResolvedValue();

    const result = await service.recoverDungeon('cultivator-1', 'retry_settle');

    expect(result).toMatchObject({
      isFinished: true,
      settlement: state.settlement,
      realGains: gains,
    });
    expect(objectMock).not.toHaveBeenCalled();
    expect(resourceGainMock).not.toHaveBeenCalled();
    expect(archiveSpy).toHaveBeenCalledWith(state, state.settlement, gains);
  });

  it('rejects deferred settlement persistence when the run was already finished', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    state.runId = '00000000-0000-0000-0000-000000000001';
    state.status = 'SETTLING';
    state.settlement = createSettlement();
    state.realGains = [{ type: 'spirit_stones' as const, value: 10 }];
    state.gainLedger = [
      {
        source: 'settlement',
        gains: state.realGains,
        committedAt: new Date(0).toISOString(),
      },
    ];
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(() => ({
              limit: vi.fn(async () => [
                {
                  id: state.runId,
                  status: 'FINISHED',
                  endedAt: new Date(),
                },
              ]),
            })),
          })),
        })),
      })),
    };

    const result = await service.settleDungeon(state, {
      deferPersistence: true,
    });

    await expect(result.persist?.(tx as unknown as never)).rejects.toMatchObject({
      code: DungeonFlowErrorCode.INVALID_STATE,
      message: '当前副本已完成，请刷新查看结算',
      status: 409,
    });
  });

  it('keeps archive failures recoverable instead of presenting a finished settlement', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    const gains = [{ type: 'spirit_stones' as const, value: 10 }];
    state.status = 'SETTLING';
    state.settlement = createSettlement();
    state.realGains = gains;
    state.gainLedger = [
      {
        source: 'settlement',
        gains,
        committedAt: new Date(0).toISOString(),
      },
    ];
    vi.spyOn(service, 'saveState').mockResolvedValue();
    vi.mocked(getExecutor).mockReturnValue({
      transaction: vi.fn().mockRejectedValue(new Error('archive DB down')),
    } as unknown as ReturnType<typeof getExecutor>);

    const result = await service.settleDungeon(state);

    expect(result).toMatchObject({
      isFinished: false,
      state: {
        status: 'RECOVERABLE_ERROR',
        isFinished: false,
        statusReason: 'archive DB down',
        recoverableActions: ['retry_settle', 'force_quit'],
        settlement: state.settlement,
        realGains: gains,
      },
    });
    expect(objectMock).not.toHaveBeenCalled();
    expect(resourceGainMock).not.toHaveBeenCalled();
  });

  it('archives a dungeon without overwriting the cultivator condition', async () => {
    const service = new DungeonService();
    const state = createDungeonState('easy-map');
    const settlement = createSettlement();
    const valuesMock = vi.fn();
    const insertMock = vi.fn(() => ({ values: valuesMock }));
    const updateMock = vi.fn();
    vi.mocked(getExecutor).mockReturnValue({
      transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
        callback({
          insert: insertMock,
          update: updateMock,
        }),
      ),
    } as unknown as ReturnType<typeof getExecutor>);

    await service.archiveDungeon(state, settlement);

    expect(insertMock).toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
