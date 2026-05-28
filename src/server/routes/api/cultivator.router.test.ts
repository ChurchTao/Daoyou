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

vi.mock('@shared/config/redeemRewardPresets', () => ({
  getRedeemPresetById: vi.fn(),
}));

vi.mock('@shared/engine/cultivation/CultivationEngine', () => ({
  attemptBreakthrough: vi.fn(),
  performCultivation: vi.fn(),
}));

vi.mock('@shared/engine/material/creation/MaterialGenerator', () => ({
  MaterialGenerator: class MaterialGenerator {},
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
  },
}));

import { getExecutor } from '@server/lib/drizzle/db';
import { consumeLifespanAndHandleDepletion } from '@server/lib/lifespan/handleLifespan';
import { renderPrompt } from '@server/lib/prompts';
import { getLifespanLimiter } from '@server/lib/redis/lifespanLimiter';
import { InnRecoveryService } from '@server/lib/services/InnRecoveryService';
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
import cultivatorRouter from './cultivator.router';

const getExecutorMock = getExecutor as unknown as Mock;
const consumeLifespanAndHandleDepletionMock =
  consumeLifespanAndHandleDepletion as unknown as Mock;
const renderPromptMock = renderPrompt as unknown as Mock;
const getLifespanLimiterMock = getLifespanLimiter as unknown as Mock;
const buildRecoveryResultMock =
  InnRecoveryService.buildRecoveryResult as unknown as Mock;
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
