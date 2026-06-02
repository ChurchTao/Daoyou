import type { RetreatStreamEvent } from '@shared/contracts/retreat';
import type { CultivatorCondition } from '@shared/types/condition';
import type { CultivationProgress, Cultivator } from '@shared/types/cultivator';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireUser: () => async (context: any, next: () => Promise<void>) => {
    context.set('user', { id: 'user-1' });
    await next();
  },
  requireActiveCultivator:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('user', { id: 'user-1' });
      context.set('cultivator', {
        id: 'cultivator-1',
        status: 'active',
      });
      await next();
    },
}));

vi.mock('@server/lib/hono/response', () => ({
  jsonWithStatus: (context: any, body: unknown, status: number) =>
    context.json(body, status),
}));

vi.mock('@server/lib/http/response', () => ({
  runDetached: vi.fn(),
}));

vi.mock('@server/lib/lifespan/handleLifespan', () => ({
  consumeLifespanAndHandleDepletion: vi.fn(),
}));

vi.mock('@server/lib/prompts', () => ({
  renderPrompt: vi.fn(),
}));

vi.mock('@server/lib/redeem/code', () => ({
  isValidRedeemCodeFormat: vi.fn(() => true),
  normalizeRedeemCode: vi.fn((code: string) => code),
}));

vi.mock('@server/lib/redis', () => ({
  redis: {
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('@server/lib/redis/lifespanLimiter', () => ({
  getLifespanLimiter: vi.fn(),
}));

vi.mock('@server/lib/repositories/creationProductRepository', () => ({
  findEquippedArtifacts: vi.fn(),
}));

vi.mock('@server/lib/repositories/worldChatRepository', () => ({
  createMessage: vi.fn(),
}));

vi.mock('@server/lib/services/ConsumableUseEngine', () => ({
  ConsumableUseEngine: {
    consume: vi.fn(),
  },
}));

vi.mock('@server/lib/services/MailService', () => ({
  MailService: {
    sendMail: vi.fn(),
  },
}));

vi.mock('@server/lib/services/PillOperationExecutor', () => ({
  PillOperationExecutor: {
    consumeBreakthroughSupportStatuses: vi.fn(),
  },
}));

vi.mock('@server/lib/services/MarketService', () => ({
  identifyMysteryMaterial: vi.fn(),
  MarketServiceError: class MarketServiceError extends Error {},
}));

vi.mock('@server/lib/services/TaskService', () => ({
  TaskService: {
    getMajorBreakthroughGate: vi.fn(),
    syncCultivatorTasks: vi.fn(),
  },
}));

vi.mock('@server/lib/services/InnRecoveryService', () => ({
  InnRecoveryService: {
    buildRecoveryResult: vi.fn(),
  },
}));

vi.mock('@server/lib/services/cultivatorService', () => ({
  addBreakthroughHistoryEntry: vi.fn(),
  addRetreatRecord: vi.fn(),
  equipEquipment: vi.fn(),
  getCultivatorArtifacts: vi.fn(),
  getCultivatorById: vi.fn(),
  getCultivatorConsumables: vi.fn(),
  getCultivatorMaterials: vi.fn(),
  getLastDeadCultivatorSummary: vi.fn(),
  getPaginatedInventoryByType: vi.fn(),
  updateCultivationExp: vi.fn(),
  updateCultivator: vi.fn(),
  updateLastYieldAt: vi.fn(),
  updateSpiritStones: vi.fn(),
}));

vi.mock('@server/utils/aiClient', () => ({
  stream_text: vi.fn(),
}));

vi.mock('@shared/engine/cultivation/CultivationEngine', () => ({
  attemptBreakthrough: vi.fn(),
  performCultivation: vi.fn(),
}));

vi.mock('@shared/engine/material/creation/MaterialGenerator', () => ({
  MaterialGenerator: {
    generateRandom: vi.fn(),
  },
}));

vi.mock('@shared/engine/resource/ResourceEngine', () => ({
  resourceEngine: {
    applyOperations: vi.fn(),
  },
}));

vi.mock('@shared/engine/yield/YieldCalculator', () => ({
  YieldCalculator: {
    calculateYield: vi.fn(),
    calculateMaterialCount: vi.fn(),
    getMaterialQualityChanceMap: vi.fn(),
  },
}));

import { getExecutor } from '@server/lib/drizzle/db';
import { runDetached } from '@server/lib/http/response';
import { consumeLifespanAndHandleDepletion } from '@server/lib/lifespan/handleLifespan';
import { renderPrompt } from '@server/lib/prompts';
import { redis } from '@server/lib/redis';
import { getLifespanLimiter } from '@server/lib/redis/lifespanLimiter';
import { InnRecoveryService } from '@server/lib/services/InnRecoveryService';
import { MailService } from '@server/lib/services/MailService';
import { PillOperationExecutor } from '@server/lib/services/PillOperationExecutor';
import { TaskService } from '@server/lib/services/TaskService';
import {
  addBreakthroughHistoryEntry,
  addRetreatRecord,
  getCultivatorById,
  updateCultivator,
} from '@server/lib/services/cultivatorService';
import { stream_text } from '@server/utils/aiClient';
import {
  attemptBreakthrough,
  performCultivation,
} from '@shared/engine/cultivation/CultivationEngine';
import { MaterialGenerator } from '@shared/engine/material/creation/MaterialGenerator';
import { YieldCalculator } from '@shared/engine/yield/YieldCalculator';
import cultivatorRouter from './cultivator.router';

const getExecutorMock = getExecutor as unknown as Mock;
const runDetachedMock = runDetached as unknown as Mock;
const consumeLifespanAndHandleDepletionMock =
  consumeLifespanAndHandleDepletion as unknown as Mock;
const renderPromptMock = renderPrompt as unknown as Mock;
const redisSetMock = redis.set as unknown as Mock;
const redisDelMock = redis.del as unknown as Mock;
const getLifespanLimiterMock = getLifespanLimiter as unknown as Mock;
const buildRecoveryResultMock =
  InnRecoveryService.buildRecoveryResult as unknown as Mock;
const sendMailMock = MailService.sendMail as unknown as Mock;
const consumeBreakthroughSupportStatusesMock =
  PillOperationExecutor.consumeBreakthroughSupportStatuses as unknown as Mock;
const getMajorBreakthroughGateMock =
  TaskService.getMajorBreakthroughGate as unknown as Mock;
const addBreakthroughHistoryEntryMock =
  addBreakthroughHistoryEntry as unknown as Mock;
const addRetreatRecordMock = addRetreatRecord as unknown as Mock;
const getCultivatorByIdMock = getCultivatorById as unknown as Mock;
const updateCultivatorMock = updateCultivator as unknown as Mock;
const streamTextMock = stream_text as unknown as Mock;
const attemptBreakthroughMock = attemptBreakthrough as unknown as Mock;
const performCultivationMock = performCultivation as unknown as Mock;
const generateRandomMaterialsMock =
  MaterialGenerator.generateRandom as unknown as Mock;
const calculateYieldMock = YieldCalculator.calculateYield as unknown as Mock;
const calculateMaterialCountMock =
  YieldCalculator.calculateMaterialCount as unknown as Mock;
const getMaterialQualityChanceMapMock =
  YieldCalculator.getMaterialQualityChanceMap as unknown as Mock;

function createApp() {
  return new Hono().route('/api/cultivator', cultivatorRouter);
}

function createCultivator(): Cultivator {
  return {
    id: 'cultivator-1',
    name: '韩立',
    gender: '男',
    realm: '筑基',
    realm_stage: '初期',
    age: 30,
    lifespan: 180,
    status: 'active',
    attributes: {
      vitality: 40,
      spirit: 36,
      wisdom: 30,
      speed: 28,
      willpower: 32,
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
    max_skills: 4,
    spirit_stones: 9000,
    cultivation_progress: {
      cultivation_exp: 880,
      exp_cap: 1000,
      comprehension_insight: 40,
      breakthrough_failures: 0,
      bottleneck_state: false,
      inner_demon: false,
      deviation_risk: 0,
    },
    condition: {
      version: 1,
      resources: {
        hp: { current: 80 },
        mp: { current: 30 },
      },
      gauges: {
        pillToxicity: 12,
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
      },
      statuses: [],
      timestamps: {
        lastRecoveryAt: '2026-05-25T00:00:00.000Z',
      },
    },
  };
}

function mockTransactionReturning(rows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));

  getExecutorMock.mockReturnValue({
    transaction: async (
      callback: (tx: { update: typeof update }) => Promise<unknown>,
    ) => callback({ update }),
  } as any);

  return { update, set, where, returning };
}

function createLimiterMocks() {
  return {
    acquireRetreatLock: vi.fn().mockResolvedValue(true),
    releaseRetreatLock: vi.fn().mockResolvedValue(undefined),
    checkAndConsumeLifespan: vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 188,
      consumed: 12,
    }),
    rollbackLifespan: vi.fn().mockResolvedValue(undefined),
    getConsumedLifespan: vi.fn(),
    getRemainingLifespan: vi.fn(),
    isRetreatLocked: vi.fn(),
  };
}

function createTextStream(...chunks: string[]) {
  return {
    textStream: (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })(),
  };
}

function parseSseEvents(raw: string): RetreatStreamEvent[] {
  return raw
    .split('\n\n')
    .map((block) =>
      block
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('\n')
        .trim(),
    )
    .filter(Boolean)
    .map((payload) => JSON.parse(payload) as RetreatStreamEvent);
}

describe('cultivator redeem route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claims a snapshot-backed redeem code and sends a reward mail', async () => {
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    const tx = {
      query: {
        redeemCodes: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'redeem-1',
            code: 'SPRING2026',
            rewardAttachments: [
              {
                type: 'spirit_stones',
                name: '灵石',
                quantity: 500,
              },
            ],
            status: 'active',
            startsAt: null,
            endsAt: null,
            totalLimit: null,
            claimedCount: 0,
            mailTitle: '活动奖励',
            mailContent: '请查收奖励。',
          }),
        },
        redeemCodeClaims: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 'redeem-1' }]),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: insertValuesMock,
      })),
    };

    getExecutorMock.mockReturnValue({
      transaction: async (callback: (innerTx: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as any);
    sendMailMock.mockResolvedValue({ id: 'mail-1' });

    const response = await createApp().request('/api/cultivator/redeem-code/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'SPRING2026' }),
    });

    expect(response.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledWith(
      'cultivator-1',
      '活动奖励',
      '请查收奖励。',
      [
        {
          type: 'spirit_stones',
          name: '灵石',
          quantity: 500,
        },
      ],
      'reward',
      tx,
    );
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: '兑换成功，奖励已通过传音玉简发放',
      mailId: 'mail-1',
    });
  });

  it('treats legacy redeem codes without reward attachments as expired', async () => {
    const tx = {
      query: {
        redeemCodes: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'legacy-redeem-1',
            code: 'OLD2025',
            rewardAttachments: null,
            status: 'active',
            startsAt: null,
            endsAt: null,
            totalLimit: null,
            claimedCount: 0,
            mailTitle: '旧奖励',
            mailContent: '请查收奖励。',
          }),
        },
        redeemCodeClaims: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      update: vi.fn(),
      insert: vi.fn(),
    };

    getExecutorMock.mockReturnValue({
      transaction: async (callback: (innerTx: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as any);

    const response = await createApp().request('/api/cultivator/redeem-code/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'OLD2025' }),
    });

    expect(response.status).toBe(400);
    expect(sendMailMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: '兑换码已失效',
    });
  });
});

describe('cultivator yield route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getExecutorMock.mockReturnValue({
      transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({}),
    } as any);
    redisSetMock.mockResolvedValue('OK');
    redisDelMock.mockResolvedValue(1);
    renderPromptMock.mockReturnValue({
      system: 'system prompt',
      user: 'user prompt',
    });
    streamTextMock.mockReturnValue(createTextStream('福缘乍现，', '清光落袖。'));
    runDetachedMock.mockImplementation(() => undefined);
  });

  it('passes realm-based quality chances to material generation', async () => {
    const cultivator = {
      ...createCultivator(),
      realm: '元婴',
      last_yield_at: new Date(Date.now() - 6 * 60 * 60 * 1000),
    };
    const qualityChanceMap = {
      凡品: 0.18,
      灵品: 0.24,
      玄品: 0.23,
      真品: 0.16,
      地品: 0.12,
      天品: 0.06,
      仙品: 0.01,
      神品: 0,
    };

    getCultivatorByIdMock.mockResolvedValue(cultivator);
    calculateYieldMock.mockReturnValue([
      { type: 'spirit_stones', value: 1200 },
      { type: 'cultivation_exp', value: 80 },
    ]);
    calculateMaterialCountMock.mockReturnValue(2);
    getMaterialQualityChanceMapMock.mockReturnValue(qualityChanceMap);
    const generatedMaterials = [
      {
        name: '寒髓晶',
        type: 'ore',
        rank: '天品',
        element: '水',
        description: '寒气凝髓，晶光自敛。',
        quantity: 1,
        price: 50000,
      },
    ];
    generateRandomMaterialsMock.mockResolvedValue(generatedMaterials);
    sendMailMock.mockResolvedValue({ id: 'mail-1' });

    const response = await createApp().request('/api/cultivator/yield', {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    const events = parseSseEvents(await response.text()) as any[];
    expect(events[0]).toEqual({
      type: 'result',
      data: expect.objectContaining({
        cultivatorRealm: '元婴',
        amount: 1200,
        expGain: 80,
        materialCount: 2,
        materials: generatedMaterials,
      }),
    });
    expect(events.slice(1)).toEqual([
      { type: 'chunk', text: '福缘乍现，' },
      { type: 'chunk', text: '清光落袖。' },
    ]);

    // 材料和邮件现在在 SSE 流开始前同步完成，不再走 runDetached
    expect(runDetachedMock).not.toHaveBeenCalled();
    expect(getMaterialQualityChanceMapMock).toHaveBeenCalledWith('元婴');
    expect(generateRandomMaterialsMock).toHaveBeenCalledWith(2, {
      qualityChanceMap,
    });
    expect(sendMailMock).toHaveBeenCalledWith(
      'cultivator-1',
      '历练机缘',
      '道友历练途中，偶得天材地宝，特以此传音玉简送达。',
      [
        {
          type: 'material',
          name: '寒髓晶',
          quantity: 1,
          data: generatedMaterials[0],
        },
      ],
      'reward',
    );
  });
});

describe('cultivator retreat route', () => {
  let limiterMocks: ReturnType<typeof createLimiterMocks>;

  beforeEach(() => {
    vi.clearAllMocks();

    limiterMocks = createLimiterMocks();
    getLifespanLimiterMock.mockReturnValue(limiterMocks);

    const cultivator = createCultivator();

    getCultivatorByIdMock.mockResolvedValue(cultivator);
    updateCultivatorMock.mockResolvedValue(cultivator);
    addRetreatRecordMock.mockResolvedValue(undefined);
    addBreakthroughHistoryEntryMock.mockResolvedValue(undefined);
    consumeLifespanAndHandleDepletionMock.mockResolvedValue({
      depleted: false,
    });
    getMajorBreakthroughGateMock.mockResolvedValue({
      required: false,
      blocked: false,
      task: null,
    });
    consumeBreakthroughSupportStatusesMock.mockImplementation(
      (condition: Cultivator['condition']) => condition,
    );
    renderPromptMock.mockReturnValue({
      system: 'system prompt',
      user: 'user prompt',
    });
    streamTextMock.mockReturnValue(
      createTextStream('灵潮翻卷，', '石门洞开。'),
    );
  });

  it('streams a plain cultivate result without story chunks', async () => {
    const cultivator = createCultivator();
    performCultivationMock.mockReturnValue({
      cultivator: {
        ...cultivator,
        age: 42,
        closed_door_years_total: 12,
      },
      summary: {
        exp_gained: 24,
        exp_before: 880,
        exp_after: 904,
        insight_gained: 2,
        epiphany_triggered: false,
        bottleneck_entered: false,
        can_breakthrough: true,
        progress: 90.4,
      },
      record: { id: 'retreat-record-1' },
    });

    const response = await createApp().request('/api/cultivator/retreat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cultivate',
        years: 12,
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');

    const events = parseSseEvents(await response.text());
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'result',
      data: expect.objectContaining({
        action: 'cultivate',
      }),
    });
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(addRetreatRecordMock).toHaveBeenCalled();
  });

  it('streams lifespan depletion story after cultivate settlement', async () => {
    const cultivator = createCultivator();
    performCultivationMock.mockReturnValue({
      cultivator: {
        ...cultivator,
        age: 180,
        closed_door_years_total: 150,
      },
      summary: {
        exp_gained: 12,
        exp_before: 880,
        exp_after: 892,
        insight_gained: 0,
        epiphany_triggered: false,
        bottleneck_entered: false,
        can_breakthrough: true,
        progress: 89.2,
      },
      record: { id: 'retreat-record-2' },
    });
    consumeLifespanAndHandleDepletionMock.mockResolvedValue({
      depleted: true,
      storyPayload: {
        cultivator: {
          ...cultivator,
          age: 180,
          status: 'dead',
        },
        summary: {
          success: false,
          isMajor: false,
          yearsSpent: 150,
          chance: 0,
          roll: 0,
          fromRealm: '筑基',
          fromStage: '初期',
          lifespanGained: 0,
          attributeGrowth: {},
          lifespanDepleted: true,
          modifiers: {} as any,
        },
      },
    });
    streamTextMock.mockReturnValue(
      createTextStream('炉火将熄，', '余念仍指向大道。'),
    );

    const response = await createApp().request('/api/cultivator/retreat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cultivate',
        years: 150,
      }),
    });

    const events = parseSseEvents(await response.text());
    expect(events[0]).toEqual({
      type: 'result',
      data: expect.objectContaining({
        action: 'cultivate',
        storyType: 'lifespan',
        depleted: true,
      }),
    });
    expect(events.slice(1)).toEqual([
      { type: 'chunk', text: '炉火将熄，' },
      { type: 'chunk', text: '余念仍指向大道。' },
    ]);
    expect(streamTextMock).toHaveBeenCalled();
    expect(addBreakthroughHistoryEntryMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      expect.objectContaining({
        from_realm: '筑基',
        from_stage: '初期',
        to_realm: '筑基',
        to_stage: '初期',
        years_spent: 150,
        story: '炉火将熄，余念仍指向大道。',
      }),
    );
  });

  it('streams breakthrough story and persists the final history entry', async () => {
    const cultivator = createCultivator();
    attemptBreakthroughMock.mockReturnValue({
      cultivator: {
        ...cultivator,
        realm_stage: '中期',
      },
      summary: {
        success: true,
        chance: 0.82,
        roll: 0.31,
        fromRealm: '筑基',
        fromStage: '初期',
        toRealm: '筑基',
        toStage: '中期',
        lifespanGained: 20,
        attributeGrowth: { vitality: 2, spirit: 1 },
        exp_progress: 0,
        insight_value: 44,
        breakthrough_type: 'normal',
        insight_change: 0,
        inner_demon_triggered: false,
        modifiers: {
          baseChance: 0.52,
          realmDifficulty: 1,
          progressMultiplier: 1,
          insightMultiplier: 1,
          wisdomMultiplier: 1,
          demonPenalty: 1,
          fateBonus: 0.02,
          pillBonus: 0.04,
          toxicityPenalty: 0,
          finalChance: 0.82,
        },
      },
      historyEntry: {
        from_realm: '筑基',
        from_stage: '初期',
        to_realm: '筑基',
        to_stage: '中期',
        age: 31,
        years_spent: 1,
      },
    });
    streamTextMock.mockReturnValue(
      createTextStream('天光一线，', '丹田轰鸣。'),
    );

    const response = await createApp().request('/api/cultivator/retreat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'breakthrough',
      }),
    });

    const events = parseSseEvents(await response.text());
    expect(events[0]).toEqual({
      type: 'result',
      data: expect.objectContaining({
        action: 'breakthrough',
        storyType: 'breakthrough',
      }),
    });
    expect(events.slice(1)).toEqual([
      { type: 'chunk', text: '天光一线，' },
      { type: 'chunk', text: '丹田轰鸣。' },
    ]);
    expect(addBreakthroughHistoryEntryMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      expect.objectContaining({
        story: '天光一线，丹田轰鸣。',
      }),
    );
  });

  it('keeps blocked major breakthroughs on JSON errors', async () => {
    getMajorBreakthroughGateMock.mockResolvedValue({
      required: true,
      blocked: true,
      task: {
        id: 'task-major',
      },
    });

    const response = await createApp().request('/api/cultivator/retreat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'breakthrough',
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: '大境界突破仍需先完成破境任务',
      errorCode: 'MAJOR_BREAKTHROUGH_TASK_REQUIRED',
      data: {
        task: {
          id: 'task-major',
        },
      },
    });
  });

  it('keeps lock conflicts on JSON errors', async () => {
    limiterMocks.acquireRetreatLock.mockResolvedValue(false);

    const response = await createApp().request('/api/cultivator/retreat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cultivate',
        years: 12,
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: '角色正在闭关中，请稍后再试',
    });
  });

  it('keeps invalid years on JSON errors', async () => {
    const response = await createApp().request('/api/cultivator/retreat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cultivate',
        years: 0,
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '闭关年限需在 1~200 年之间',
    });
  });
});

describe('cultivator inn recovery route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the inn recovery settlement payload on success', async () => {
    const cultivator = createCultivator();
    const currentCondition = cultivator.condition as CultivatorCondition;
    const currentProgress =
      cultivator.cultivation_progress as CultivationProgress;
    const nextCondition: CultivatorCondition = {
      ...currentCondition,
      resources: {
        hp: { current: 200 },
        mp: { current: 120 },
      },
      statuses: [],
    };
    const nextCultivationProgress: CultivationProgress = {
      ...currentProgress,
      cultivation_exp: 809,
    };
    getCultivatorByIdMock.mockResolvedValueOnce(cultivator);
    buildRecoveryResultMock.mockReturnValueOnce({
      spiritStoneCost: 3000,
      nextCondition,
      nextCultivationProgress,
      cultivationLossPercent: 8,
      cultivationLossAmount: 71,
      clearedStatusCount: 2,
    });
    mockTransactionReturning([{ spiritStones: 6000 }]);

    const response = await createApp().request('/api/cultivator/inn-recovery', {
      method: 'POST',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        cultivator: {
          ...cultivator,
          spirit_stones: 6000,
          cultivation_progress: nextCultivationProgress,
          condition: nextCondition,
        },
        spiritStoneCost: 3000,
        cultivationLossPercent: 8,
        cultivationLossAmount: 71,
        clearedStatusCount: 2,
      },
    });
    expect(getCultivatorByIdMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
    );
    expect(buildRecoveryResultMock).toHaveBeenCalledWith(cultivator);
  });

  it('returns 400 when the cultivator cannot afford the inn recovery fee', async () => {
    const cultivator = createCultivator();
    const currentCondition = cultivator.condition as CultivatorCondition;
    const currentProgress =
      cultivator.cultivation_progress as CultivationProgress;
    getCultivatorByIdMock.mockResolvedValueOnce(cultivator);
    buildRecoveryResultMock.mockReturnValueOnce({
      spiritStoneCost: 3000,
      nextCondition: currentCondition,
      nextCultivationProgress: currentProgress,
      cultivationLossPercent: 5,
      cultivationLossAmount: 44,
      clearedStatusCount: 1,
    });
    mockTransactionReturning([]);

    const response = await createApp().request('/api/cultivator/inn-recovery', {
      method: 'POST',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: '囊中羞涩，灵石不足（至少需要 3000 灵石）',
    });
  });
});
