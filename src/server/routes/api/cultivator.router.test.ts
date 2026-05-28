import { Hono } from 'hono';
import type {
  CultivationProgress,
  Cultivator,
} from '@shared/types/cultivator';
import type { CultivatorCondition } from '@shared/types/condition';
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
  getLifespanLimiter: vi.fn(() => ({
    acquireRetreatLock: vi.fn(),
    releaseRetreatLock: vi.fn(),
    checkAndConsumeLifespan: vi.fn(),
    rollbackLifespan: vi.fn(),
    getConsumedLifespan: vi.fn(),
    getRemainingLifespan: vi.fn(),
    isRetreatLocked: vi.fn(),
  })),
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

vi.mock('@server/utils/storyService', () => ({
  createBreakthroughStory: vi.fn(),
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
import { InnRecoveryService } from '@server/lib/services/InnRecoveryService';
import { getCultivatorById } from '@server/lib/services/cultivatorService';
import cultivatorRouter from './cultivator.router';

const getExecutorMock = getExecutor as unknown as Mock;
const getCultivatorByIdMock = getCultivatorById as unknown as Mock;
const buildRecoveryResultMock =
  InnRecoveryService.buildRecoveryResult as unknown as Mock;

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
    transaction: async (callback: (tx: { update: typeof update }) => Promise<unknown>) =>
      callback({ update }),
  } as any);

  return { update, set, where, returning };
}

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
    expect(getCultivatorByIdMock).toHaveBeenCalledWith('user-1', 'cultivator-1');
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
