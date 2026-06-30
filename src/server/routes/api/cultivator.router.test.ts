import type { RetreatStreamEvent } from '@shared/contracts/retreat';
import type { CultivatorCondition } from '@shared/types/condition';
import type { CultivationProgress, Cultivator } from '@shared/types/cultivator';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const { createRedisLockMock, releaseRedisLockMock, lockAcquireMock } =
  vi.hoisted(() => ({
    createRedisLockMock: vi.fn(),
    releaseRedisLockMock: vi.fn(),
    lockAcquireMock: vi.fn(async () => undefined),
  }));

vi.mock('@server/lib/drizzle/db', () => ({
  db: vi.fn(),
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
        qi: 100,
      });
      await next();
    },
  requireActiveCultivatorRef:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('user', { id: 'user-1' });
      context.set('activeCultivatorRef', {
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
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

vi.mock('@server/lib/redis/lock', () => ({
  createRedisLock: createRedisLockMock,
  releaseRedisLock: releaseRedisLockMock,
  LockAcquisitionError: class LockAcquisitionError extends Error {},
}));

vi.mock('@server/lib/redis/retreatLock', () => ({
  getRetreatLock: vi.fn(),
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

vi.mock('@server/lib/services/QiService', () => ({
  QiInsufficientError: class QiInsufficientError extends Error {
    code = 'QI_INSUFFICIENT';
    action: string;
    required: number;
    current: number;

    constructor(args: { action: string; required: number; current: number }) {
      super('天地灵气不足');
      this.action = args.action;
      this.required = args.required;
      this.current = args.current;
    }
  },
  QiServiceError: class QiServiceError extends Error {
    status: number;

    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  QiService: {
    getQiState: vi.fn(),
    listLogs: vi.fn(),
    reserveQi: vi.fn(),
    commitReservation: vi.fn(),
    markNoRefund: vi.fn(),
    refundReservation: vi.fn(),
    restoreQi: vi.fn(),
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
  consumeConsumableById: vi.fn(),
  consumeMaterialById: vi.fn(),
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
    gainInTransaction: vi.fn(),
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
import { db } from '@server/lib/drizzle/db';
import { runDetached } from '@server/lib/http/response';
import { consumeLifespanAndHandleDepletion } from '@server/lib/lifespan/handleLifespan';
import { renderPrompt } from '@server/lib/prompts';
import { redis } from '@server/lib/redis';
import { LockAcquisitionError } from '@server/lib/redis/lock';
import { getRetreatLock } from '@server/lib/redis/retreatLock';
import { InnRecoveryService } from '@server/lib/services/InnRecoveryService';
import { MailService } from '@server/lib/services/MailService';
import { ConsumableUseEngine } from '@server/lib/services/ConsumableUseEngine';
import { PillOperationExecutor } from '@server/lib/services/PillOperationExecutor';
import { QiService, QiServiceError } from '@server/lib/services/QiService';
import { TaskService } from '@server/lib/services/TaskService';
import {
  addBreakthroughHistoryEntry,
  addRetreatRecord,
  consumeConsumableById,
  consumeMaterialById,
  getCultivatorById,
  updateCultivationExp,
  updateCultivator,
  updateSpiritStones,
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
const dbMock = db as unknown as Mock;
const runDetachedMock = runDetached as unknown as Mock;
const consumeLifespanAndHandleDepletionMock =
  consumeLifespanAndHandleDepletion as unknown as Mock;
const renderPromptMock = renderPrompt as unknown as Mock;
const redisSetMock = redis.set as unknown as Mock;
const redisDelMock = redis.del as unknown as Mock;
const getRetreatLockMock = getRetreatLock as unknown as Mock;
const buildRecoveryResultMock =
  InnRecoveryService.buildRecoveryResult as unknown as Mock;
const sendMailMock = MailService.sendMail as unknown as Mock;
const consumeMock = ConsumableUseEngine.consume as unknown as Mock;
const consumeConsumableByIdMock = consumeConsumableById as unknown as Mock;
const consumeMaterialByIdMock = consumeMaterialById as unknown as Mock;
const consumeBreakthroughSupportStatusesMock =
  PillOperationExecutor.consumeBreakthroughSupportStatuses as unknown as Mock;
const getQiStateMock = QiService.getQiState as unknown as Mock;
const listLogsMock = QiService.listLogs as unknown as Mock;
const reserveQiMock = QiService.reserveQi as unknown as Mock;
const commitReservationMock = QiService.commitReservation as unknown as Mock;
const markNoRefundMock = QiService.markNoRefund as unknown as Mock;
const refundReservationMock = QiService.refundReservation as unknown as Mock;
const getMajorBreakthroughGateMock =
  TaskService.getMajorBreakthroughGate as unknown as Mock;
const syncCultivatorTasksMock =
  TaskService.syncCultivatorTasks as unknown as Mock;
const addBreakthroughHistoryEntryMock =
  addBreakthroughHistoryEntry as unknown as Mock;
const addRetreatRecordMock = addRetreatRecord as unknown as Mock;
const getCultivatorByIdMock = getCultivatorById as unknown as Mock;
const updateCultivatorMock = updateCultivator as unknown as Mock;
const updateCultivationExpMock = updateCultivationExp as unknown as Mock;
const updateSpiritStonesMock = updateSpiritStones as unknown as Mock;
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
    unallocated_attribute_points: 0,
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
        longevityPillUsesByRealm: {},
      },
      statuses: [],
      timestamps: {
        lastRecoveryAt: '2026-05-25T00:00:00.000Z',
      },
    },
  };
}

function createStateVersionRow(overrides: Record<string, unknown> = {}) {
  return {
    cultivatorId: 'cultivator-1',
    globalVersion: 1,
    profileVersion: 0,
    conditionVersion: 0,
    progressVersion: 0,
    currencyVersion: 0,
    inventoryVersion: 0,
    productsVersion: 0,
    mailVersion: 0,
    tasksVersion: 0,
    updatedAt: new Date('2026-06-10T00:00:00.000Z'),
    ...overrides,
  };
}

function createStateEventRows(
  events: Array<{
    id?: number;
    domain: string;
    eventType: string;
    patch?: unknown;
    invalidates?: string[];
    source: string;
  }>,
) {
  return events.map((event, index) => ({
    id: event.id ?? index + 1,
    cultivatorId: 'cultivator-1',
    userId: 'user-1',
    globalVersion: 1,
    domain: event.domain,
    eventType: event.eventType,
    patch: event.patch ?? {},
    invalidates: event.invalidates ?? [],
    source: event.source,
    requestId: null,
    createdAt: new Date('2026-06-10T00:00:00.000Z'),
  }));
}

function mockStateOnlyTransaction(args: {
  versionRow?: Record<string, unknown>;
  eventRows: ReturnType<typeof createStateEventRows>;
}) {
  const insertReturning = vi
    .fn()
    .mockResolvedValueOnce([args.versionRow ?? createStateVersionRow()])
    .mockResolvedValueOnce(args.eventRows);
  const onConflictDoUpdate = vi.fn(() => ({ returning: insertReturning }));
  const values = vi.fn(() => ({
    onConflictDoUpdate,
    returning: insertReturning,
  }));
  const insert = vi.fn(() => ({ values }));
  const txMock = { insert };

  dbMock.mockReturnValue({
    transaction: async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
  } as any);

  return txMock;
}

function mockAttributeAllocationTransaction(args: {
  current: {
    realm: string;
    realmStage: string;
    vitality: number;
    spirit: number;
    wisdom: number;
    speed: number;
    willpower: number;
    unallocatedAttributePoints: number;
  };
}) {
  const selectWhere = vi.fn().mockResolvedValue([
    {
      id: 'cultivator-1',
      ...args.current,
    },
  ]);
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));
  const updateReturning = vi.fn().mockResolvedValue([
      {
        vitality: args.current.vitality + 2,
        spirit: args.current.spirit + 1,
        wisdom: args.current.wisdom,
        speed: args.current.speed,
        willpower: args.current.willpower,
        unallocated_attribute_points:
          args.current.unallocatedAttributePoints - 3,
      },
    ]);
  const updateWhere = vi.fn(() => ({ returning: updateReturning }));
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  const insertReturning = vi
    .fn()
    .mockResolvedValueOnce([createStateVersionRow()])
    .mockResolvedValueOnce(
      createStateEventRows([
        {
          domain: 'profile',
          eventType: 'profile.attributes.allocated',
          source: 'profile_attribute_allocate',
          invalidates: ['profile'],
        },
      ]),
    );
  const onConflictDoUpdate = vi.fn(() => ({ returning: insertReturning }));
  const values = vi.fn(() => ({
    onConflictDoUpdate,
    returning: insertReturning,
  }));
  const insert = vi.fn(() => ({ values }));
  const txMock = { select, update, insert };

  dbMock.mockReturnValue({
    transaction: async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
  } as any);

  return { select, update, set, updateWhere, updateReturning };
}

function mockTransactionReturning(rows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const versionRow = {
    cultivatorId: 'cultivator-1',
    globalVersion: 1,
    profileVersion: 0,
    conditionVersion: 1,
    progressVersion: 1,
    currencyVersion: 1,
    inventoryVersion: 0,
    productsVersion: 0,
    mailVersion: 0,
    tasksVersion: 0,
    updatedAt: new Date('2026-06-10T00:00:00.000Z'),
  };
  const eventRows = [
    {
      id: 1,
      cultivatorId: 'cultivator-1',
      userId: 'user-1',
      globalVersion: 1,
      domain: 'condition',
      eventType: 'condition.recovered',
      patch: {},
      invalidates: [],
      source: 'inn_recovery',
      requestId: null,
      createdAt: new Date('2026-06-10T00:00:00.000Z'),
    },
  ];
  const insertReturning = vi
    .fn()
    .mockResolvedValueOnce([versionRow])
    .mockResolvedValueOnce(eventRows);
  const onConflictDoUpdate = vi.fn(() => ({ returning: insertReturning }));
  const values = vi.fn(() => ({
    onConflictDoUpdate,
    returning: insertReturning,
  }));
  const insert = vi.fn(() => ({ values }));
  const txMock = { update, insert };

  getExecutorMock.mockReturnValue({
    transaction: async (
      callback: (tx: { update: typeof update }) => Promise<unknown>,
    ) => callback({ update }),
  } as any);
  dbMock.mockReturnValue({
    transaction: async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
  } as any);

  return { update, set, where, returning, insert, values, insertReturning };
}

function mockMailReadTransaction(unreadCount: number) {
  const updateWhere = vi.fn();
  const set = vi.fn(() => ({ where: updateWhere }));
  const update = vi.fn(() => ({ set }));
  const selectWhere = vi.fn().mockResolvedValue([{ count: unreadCount }]);
  const from = vi.fn(() => ({ where: selectWhere }));
  const select = vi.fn(() => ({ from }));
  const versionRow = {
    cultivatorId: 'cultivator-1',
    globalVersion: 1,
    profileVersion: 0,
    conditionVersion: 0,
    progressVersion: 0,
    currencyVersion: 0,
    inventoryVersion: 0,
    productsVersion: 0,
    mailVersion: 1,
    tasksVersion: 0,
    updatedAt: new Date('2026-06-10T00:00:00.000Z'),
  };
  const eventRows = [
    {
      id: 11,
      cultivatorId: 'cultivator-1',
      userId: 'user-1',
      globalVersion: 1,
      domain: 'mail',
      eventType: 'mail.read',
      patch: {
        unreadMailCount: unreadCount,
        mailIds: ['mail-1'],
      },
      invalidates: ['mail'],
      source: 'mail_read',
      requestId: null,
      createdAt: new Date('2026-06-10T00:00:00.000Z'),
    },
  ];
  const insertReturning = vi
    .fn()
    .mockResolvedValueOnce([versionRow])
    .mockResolvedValueOnce(eventRows);
  const onConflictDoUpdate = vi.fn(() => ({ returning: insertReturning }));
  const values = vi.fn(() => ({
    onConflictDoUpdate,
    returning: insertReturning,
  }));
  const insert = vi.fn(() => ({ values }));
  const txMock = { update, select, insert };

  dbMock.mockReturnValue({
    transaction: async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
  } as any);

  return { update, set, updateWhere, select, from, selectWhere, insert };
}

function mockConsumeTransaction() {
  const selectedCultivator = {
    condition: {},
    cultivationProgress: {},
    spiritStones: 128,
    qi: 150,
    lifespan: 120,
    vitality: 10,
    spirit: 10,
    wisdom: 10,
    speed: 10,
    willpower: 10,
  };
  const limit = vi.fn().mockResolvedValue([selectedCultivator]);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  const versionRow = {
    cultivatorId: 'cultivator-1',
    globalVersion: 1,
    profileVersion: 0,
    conditionVersion: 0,
    progressVersion: 0,
    currencyVersion: 1,
    inventoryVersion: 1,
    productsVersion: 0,
    mailVersion: 0,
    tasksVersion: 1,
    updatedAt: new Date('2026-06-10T00:00:00.000Z'),
  };
  const eventRows = [
    {
      id: 21,
      cultivatorId: 'cultivator-1',
      userId: 'user-1',
      globalVersion: 1,
      domain: 'inventory',
      eventType: 'inventory.consumable.used',
      patch: {},
      invalidates: ['inventory'],
      source: 'consumable_use',
      requestId: null,
      createdAt: new Date('2026-06-10T00:00:00.000Z'),
    },
  ];
  const insertReturning = vi
    .fn()
    .mockResolvedValueOnce([versionRow])
    .mockResolvedValueOnce(eventRows);
  const onConflictDoUpdate = vi.fn(() => ({ returning: insertReturning }));
  const values = vi.fn(() => ({
    onConflictDoUpdate,
    returning: insertReturning,
  }));
  const insert = vi.fn(() => ({ values }));
  const txMock = { select, insert };

  dbMock.mockReturnValue({
    transaction: async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
  } as any);

  return txMock;
}

function mockBodyCultivationBreakthroughTransaction() {
  const versionRow = createStateVersionRow({
    conditionVersion: 1,
  });
  const eventRows = createStateEventRows([
    {
      domain: 'condition',
      eventType: 'condition.body_cultivation.breakthrough',
      source: 'body_cultivation_breakthrough',
      patch: {},
    },
    {
      domain: 'inventory',
      eventType: 'inventory.body_cultivation.breakthrough_consumed',
      source: 'body_cultivation_breakthrough',
      invalidates: ['inventory'],
    },
  ]);
  const insertReturning = vi
    .fn()
    .mockResolvedValueOnce([versionRow])
    .mockResolvedValueOnce(eventRows);
  const onConflictDoUpdate = vi.fn(() => ({ returning: insertReturning }));
  const values = vi.fn(() => ({
    onConflictDoUpdate,
    returning: insertReturning,
  }));
  const insert = vi.fn(() => ({ values }));
  const txMock = { insert };

  dbMock.mockReturnValue({
    transaction: async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
  } as any);

  return txMock;
}

function createRetreatLockMocks() {
  return {
    acquire: vi.fn().mockResolvedValue(true),
    release: vi.fn().mockResolvedValue(undefined),
    isLocked: vi.fn(),
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

describe('cultivator attribute allocation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createRedisLockMock.mockReturnValue({
      acquire: lockAcquireMock,
    });
    lockAcquireMock.mockResolvedValue(undefined);
  });

  it('allocates fixed points without enforcing a per-attribute cap', async () => {
    mockAttributeAllocationTransaction({
      current: {
        realm: '筑基',
        realmStage: '初期',
        vitality: 67,
        spirit: 20,
        wisdom: 20,
        speed: 20,
        willpower: 20,
        unallocatedAttributePoints: 3,
      },
    });

    const response = await createApp().request(
      '/api/cultivator/attributes/allocate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vitality: 2,
          spirit: 1,
          wisdom: 0,
          speed: 0,
          willpower: 0,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(createRedisLockMock).toHaveBeenCalledWith({
      retries: 0,
      delay: 50,
    });
    expect(lockAcquireMock).toHaveBeenCalledWith(
      'cultivator:attributes:allocate:lock:cultivator-1',
    );
    expect(releaseRedisLockMock).toHaveBeenCalledWith(
      expect.objectContaining({ acquire: lockAcquireMock }),
      'cultivator:attributes:allocate:lock:cultivator-1',
    );
    const json = await response.json();
    expect(json).toEqual(
      expect.objectContaining({
        success: true,
        data: {
          attributes: {
            vitality: 69,
            spirit: 21,
            wisdom: 20,
            speed: 20,
            willpower: 20,
          },
          unallocated_attribute_points: 0,
        },
      }),
    );
  });

  it('rejects overspending unallocated attribute points', async () => {
    mockAttributeAllocationTransaction({
      current: {
        realm: '筑基',
        realmStage: '初期',
        vitality: 20,
        spirit: 20,
        wisdom: 20,
        speed: 20,
        willpower: 20,
        unallocatedAttributePoints: 1,
      },
    });

    const response = await createApp().request(
      '/api/cultivator/attributes/allocate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vitality: 2,
          spirit: 0,
          wisdom: 0,
          speed: 0,
          willpower: 0,
        }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '未分配属性点不足',
    });
    expect(releaseRedisLockMock).toHaveBeenCalledWith(
      expect.objectContaining({ acquire: lockAcquireMock }),
      'cultivator:attributes:allocate:lock:cultivator-1',
    );
  });

  it('returns 429 when another allocation holds the lock', async () => {
    lockAcquireMock.mockRejectedValueOnce(
      new LockAcquisitionError('lock busy'),
    );

    const response = await createApp().request(
      '/api/cultivator/attributes/allocate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vitality: 1,
          spirit: 0,
          wisdom: 0,
          speed: 0,
          willpower: 0,
        }),
      },
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: '属性分配正在处理中，请稍后',
    });
    expect(dbMock).not.toHaveBeenCalled();
    expect(releaseRedisLockMock).not.toHaveBeenCalled();
  });
});

describe('cultivator redeem route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claims a snapshot-backed redeem code and sends a reward mail', async () => {
    const insertValuesMock = vi.fn().mockResolvedValue(undefined);
    const stateInsertReturning = vi
      .fn()
      .mockResolvedValueOnce([
        createStateVersionRow({
          mailVersion: 1,
        }),
      ])
      .mockResolvedValueOnce(
        createStateEventRows([
          {
            domain: 'mail',
            eventType: 'mail.redeem_code.created',
            patch: { unreadMailCount: 1 },
            invalidates: ['mail'],
            source: 'redeem_code_claim',
          },
        ]),
      );
    const stateInsertValues = vi.fn(() => ({
      onConflictDoUpdate: vi.fn(() => ({ returning: stateInsertReturning })),
      returning: stateInsertReturning,
    }));
    let insertCallCount = 0;
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
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ count: 1 }]),
        })),
      })),
      insert: vi.fn(() => {
        insertCallCount += 1;
        if (insertCallCount === 1) {
          return {
            values: insertValuesMock,
          };
        }
        return {
          values: stateInsertValues,
        };
      }),
    };

    dbMock.mockReturnValue({
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
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        message: '兑换成功，奖励已通过传音玉简发放',
        mailId: 'mail-1',
      },
      state: {
        cultivatorId: 'cultivator-1',
        globalVersion: 1,
      },
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

    dbMock.mockReturnValue({
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

describe('cultivator qi routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the active cultivator qi state', async () => {
    getQiStateMock.mockResolvedValueOnce({
      current: 120,
      max: 200,
    });

    const response = await createApp().request('/api/cultivator/qi');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        current: 120,
        max: 200,
      },
    });
    expect(getQiStateMock).toHaveBeenCalledWith('cultivator-1');
  });

  it('returns paginated qi logs', async () => {
    listLogsMock.mockResolvedValueOnce({
      logs: [
        {
          id: 'log-1',
          action: 'dungeon_start',
          actionInstanceId: 'action-1',
          status: 'committed',
          qiCost: 50,
          qiGain: 0,
          qiBefore: 200,
          qiAfter: 150,
          source: null,
          metadata: { mapNodeId: 'node-1' },
          createdAt: '2026-06-06T00:00:00.000Z',
          updatedAt: '2026-06-06T00:00:00.000Z',
        },
      ],
      page: 2,
      pageSize: 5,
      total: 6,
      totalPages: 2,
    });

    const response = await createApp().request(
      '/api/cultivator/qi/logs?page=2&pageSize=5',
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        logs: [
          {
            id: 'log-1',
            action: 'dungeon_start',
            actionInstanceId: 'action-1',
            status: 'committed',
            qiCost: 50,
            qiGain: 0,
            qiBefore: 200,
            qiAfter: 150,
            source: null,
            metadata: { mapNodeId: 'node-1' },
            createdAt: '2026-06-06T00:00:00.000Z',
            updatedAt: '2026-06-06T00:00:00.000Z',
          },
        ],
        page: 2,
        pageSize: 5,
        total: 6,
        totalPages: 2,
      },
    });
    expect(listLogsMock).toHaveBeenCalledWith('cultivator-1', {
      page: 2,
      pageSize: 5,
    });
  });

  it('uses qi restore talismans through the unified consume route', async () => {
    consumeMock.mockResolvedValueOnce({
      message: '已使用小聚灵符，天地灵气 +50。',
      consumable: {
        id: '11111111-1111-4111-8111-111111111111',
        name: '小聚灵符',
        spec: {
          kind: 'talisman',
          scenario: 'dungeon_start',
          sessionMode: 'consume_on_action',
        },
      },
    });
    syncCultivatorTasksMock.mockResolvedValueOnce(undefined);
    const txMock = mockConsumeTransaction();

    const response = await createApp().request('/api/cultivator/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consumableId: '11111111-1111-4111-8111-111111111111' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        message: '已使用小聚灵符，天地灵气 +50。',
        consumable: {
          id: '11111111-1111-4111-8111-111111111111',
          name: '小聚灵符',
          spec: {
            kind: 'talisman',
            scenario: 'dungeon_start',
            sessionMode: 'consume_on_action',
          },
        },
      },
      state: {
        cultivatorId: 'cultivator-1',
        globalVersion: 1,
        domainVersions: {
          currency: 1,
          inventory: 1,
          tasks: 1,
        },
        events: [
          {
            id: 21,
            cultivatorId: 'cultivator-1',
            globalVersion: 1,
            domain: 'inventory',
            eventType: 'inventory.consumable.used',
            patch: {},
            invalidates: ['inventory'],
            source: 'consumable_use',
            createdAt: '2026-06-10T00:00:00.000Z',
          },
        ],
      },
    });
    expect(consumeMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      '11111111-1111-4111-8111-111111111111',
      { tx: txMock },
    );
    expect(syncCultivatorTasksMock).toHaveBeenCalledWith('cultivator-1');
  });

  it('passes qi restore errors through the unified consume route', async () => {
    mockConsumeTransaction();
    consumeMock.mockRejectedValueOnce(
      new QiServiceError('今日聚灵符使用次数已达上限。', 409),
    );

    const response = await createApp().request('/api/cultivator/consume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consumableId: '11111111-1111-4111-8111-111111111111' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: '今日聚灵符使用次数已达上限。',
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
    updateSpiritStonesMock.mockResolvedValue(1210);
    updateCultivationExpMock.mockResolvedValue({
      cultivation_exp: 80,
      exp_cap: 100,
      comprehension_insight: 0,
    });
    const insertReturning = vi
      .fn()
      .mockResolvedValueOnce([
        createStateVersionRow({
          profileVersion: 1,
          currencyVersion: 1,
          progressVersion: 1,
        }),
      ])
      .mockResolvedValueOnce(
        createStateEventRows([
          {
            domain: 'currency',
            eventType: 'currency.yield.gained',
            invalidates: ['currency'],
            source: 'yield_claim',
          },
        ]),
      )
      .mockResolvedValueOnce([
        createStateVersionRow({
          mailVersion: 1,
        }),
      ])
      .mockResolvedValueOnce(
        createStateEventRows([
          {
            domain: 'mail',
            eventType: 'mail.yield_material.created',
            invalidates: ['mail'],
            source: 'yield_material_mail',
          },
        ]),
      );
    const values = vi.fn(() => ({
      onConflictDoUpdate: vi.fn(() => ({ returning: insertReturning })),
      returning: insertReturning,
    }));
    const tx = {
      insert: vi.fn(() => ({ values })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(async () => undefined),
        })),
      })),
    };
    dbMock.mockReturnValue({
      transaction: async (callback: (innerTx: typeof tx) => Promise<unknown>) =>
        callback(tx),
    } as any);
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
        materials: [],
      }),
    });
    expect(events[1]).toEqual({
      type: 'state',
      state: expect.objectContaining({
        events: expect.arrayContaining([
          expect.objectContaining({
            domain: 'currency',
            source: 'yield_claim',
          }),
        ]),
      }),
    });
    expect(events.slice(2)).toEqual([
      { type: 'chunk', text: '福缘乍现，' },
      { type: 'chunk', text: '清光落袖。' },
    ]);

    // 材料和邮件通过 runDetached 异步处理
    expect(runDetachedMock).toHaveBeenCalledTimes(1);
    const detachedTask = runDetachedMock.mock.calls[0]?.[0] as
      | (() => Promise<void>)
      | undefined;
    expect(detachedTask).toBeTypeOf('function');

    await detachedTask?.();

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
      expect.any(Object),
    );
  });
});

describe('cultivator body cultivation routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns body cultivation breakthrough readiness with inventory ownership', async () => {
    const cultivator = createCultivator();
    cultivator.realm = '炼气';
    cultivator.condition = {
      ...cultivator.condition!,
      tracks: {
        ...cultivator.condition!.tracks,
        bodyCultivation: {
          version: 1,
          realm: 'mortal_body',
          tracks: {
            skin: { level: 4, progress: 0 },
            sinew_bone: { level: 4, progress: 0 },
            organs: { level: 4, progress: 0 },
            qi_blood: { level: 0, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
      },
    };
    cultivator.inventory.consumables = [
      {
        id: 'pill-1',
        name: '青岚淬膜丹',
        type: '丹药',
        quality: '玄品',
        quantity: 1,
        spec: {
          kind: 'pill',
          family: 'tempering',
          operations: [],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'none',
          },
          alchemyMeta: {
            source: 'improvised',
            sourceMaterials: [],
            analysisVersion: 2,
            propertyVector: [{ key: 'body_skin', weight: 1 }],
            sourceMaterialVectors: [],
            stability: 80,
            toxicityRating: 3,
            tags: ['tempering'],
          },
        },
      },
    ];
    cultivator.inventory.materials = [
      {
        id: 'material-1',
        name: '青纹破关露',
        type: 'aux',
        rank: '玄品',
        quantity: 1,
      },
    ];
    getCultivatorByIdMock.mockResolvedValueOnce(cultivator);

    const response = await createApp().request(
      '/api/cultivator/body-cultivation/breakthrough',
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        nextRealm: 'bronze_skin',
        canAttempt: true,
        successChance: 0.82,
        guaranteeProgress: 0,
        failedAttempts: 0,
        inventoryRequirements: [
          {
            type: 'material',
            name: '进阶材料（特殊辅料，玄品以上）',
            label: '进阶材料（特殊辅料，玄品以上）',
            quantity: 1,
            ownedQuantity: 1,
            met: true,
            materialType: 'aux',
            minQuality: '玄品',
          },
          {
            type: 'consumable',
            name: '皮肤方向炼体丹（玄品以上）',
            label: '皮肤方向炼体丹（玄品以上）',
            quantity: 1,
            ownedQuantity: 1,
            met: true,
            family: 'tempering',
            property: 'body_skin',
            minQuality: '玄品',
          },
        ],
      },
    });
  });

  it('advances body cultivation realm and emits condition state events', async () => {
    const cultivator = createCultivator();
    cultivator.realm = '炼气';
    cultivator.condition = {
      ...cultivator.condition!,
      tracks: {
        ...cultivator.condition!.tracks,
        bodyCultivation: {
          version: 1,
          realm: 'mortal_body',
          tracks: {
            skin: { level: 4, progress: 0 },
            sinew_bone: { level: 4, progress: 0 },
            organs: { level: 4, progress: 0 },
            qi_blood: { level: 0, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
      },
    };
    cultivator.inventory.consumables = [
      {
        id: 'pill-1',
        name: '青岚淬膜丹',
        type: '丹药',
        quality: '玄品',
        quantity: 1,
        spec: {
          kind: 'pill',
          family: 'tempering',
          operations: [],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'none',
          },
          alchemyMeta: {
            source: 'improvised',
            sourceMaterials: [],
            analysisVersion: 2,
            propertyVector: [{ key: 'body_skin', weight: 1 }],
            sourceMaterialVectors: [],
            stability: 80,
            toxicityRating: 3,
            tags: ['tempering'],
          },
        },
      },
    ];
    cultivator.inventory.materials = [
      {
        id: 'material-1',
        name: '青纹破关露',
        type: 'aux',
        rank: '玄品',
        quantity: 1,
      },
    ];
    getCultivatorByIdMock.mockResolvedValueOnce(cultivator);
    updateCultivatorMock.mockImplementationOnce(
      async (_cultivatorId, patch) => ({
        ...cultivator,
        ...patch,
      }),
    );
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValueOnce(0);
    const tx = mockBodyCultivationBreakthroughTransaction();

    let response: Response;
    try {
      response = await createApp().request(
        '/api/cultivator/body-cultivation/breakthrough',
        {
          method: 'POST',
        },
      );
    } finally {
      randomSpy.mockRestore();
    }

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: {
        condition: {
          tracks: {
            bodyCultivation: Record<string, unknown>;
          };
        };
      };
    };
    expect(body).toMatchObject({
      success: true,
      data: {
        success: true,
        fromRealm: 'mortal_body',
        toRealm: 'bronze_skin',
        chance: 0.82,
        roll: 0,
        failedAttempts: 0,
        guaranteeProgress: 0,
        condition: {
          tracks: {
            bodyCultivation: {
              realm: 'bronze_skin',
              milestones: {
                'realm.bronze_skin': true,
              },
            },
          },
        },
      },
      state: {
        cultivatorId: 'cultivator-1',
        globalVersion: 1,
      },
    });
    expect(
      body.data.condition.tracks.bodyCultivation,
    ).not.toHaveProperty('breakthrough');
    expect(updateCultivatorMock).toHaveBeenCalledWith(
      'cultivator-1',
      {
        condition: expect.objectContaining({
          tracks: expect.objectContaining({
            bodyCultivation: expect.objectContaining({
              realm: 'bronze_skin',
            }),
          }),
        }),
      },
      tx,
    );
    expect(consumeMaterialByIdMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      'material-1',
      1,
      tx,
    );
    expect(consumeConsumableByIdMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      'pill-1',
      1,
      tx,
    );
  });

  it('records failed body cultivation breakthrough progress and still consumes costs', async () => {
    const cultivator = createCultivator();
    cultivator.realm = '炼气';
    cultivator.condition = {
      ...cultivator.condition!,
      tracks: {
        ...cultivator.condition!.tracks,
        bodyCultivation: {
          version: 1,
          realm: 'mortal_body',
          tracks: {
            skin: { level: 4, progress: 0 },
            sinew_bone: { level: 4, progress: 0 },
            organs: { level: 4, progress: 0 },
            qi_blood: { level: 0, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
      },
    };
    cultivator.inventory.consumables = [
      {
        id: 'pill-1',
        name: '青岚淬膜丹',
        type: '丹药',
        quality: '玄品',
        quantity: 1,
        spec: {
          kind: 'pill',
          family: 'tempering',
          operations: [],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'none',
          },
          alchemyMeta: {
            source: 'improvised',
            sourceMaterials: [],
            analysisVersion: 2,
            propertyVector: [{ key: 'body_skin', weight: 1 }],
            sourceMaterialVectors: [],
            stability: 80,
            toxicityRating: 3,
            tags: ['tempering'],
          },
        },
      },
    ];
    cultivator.inventory.materials = [
      {
        id: 'material-1',
        name: '青纹破关露',
        type: 'aux',
        rank: '玄品',
        quantity: 1,
      },
    ];
    getCultivatorByIdMock.mockResolvedValueOnce(cultivator);
    updateCultivatorMock.mockImplementationOnce(
      async (_cultivatorId, patch) => ({
        ...cultivator,
        ...patch,
      }),
    );
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValueOnce(0.99);
    const tx = mockBodyCultivationBreakthroughTransaction();

    let response: Response;
    try {
      response = await createApp().request(
        '/api/cultivator/body-cultivation/breakthrough',
        {
          method: 'POST',
        },
      );
    } finally {
      randomSpy.mockRestore();
    }

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        success: false,
        fromRealm: 'mortal_body',
        toRealm: 'bronze_skin',
        chance: 0.82,
        roll: 0.99,
        failedAttempts: 1,
        guaranteeProgress: 34,
        condition: {
          tracks: {
            bodyCultivation: {
              realm: 'mortal_body',
              breakthrough: {
                targetRealm: 'bronze_skin',
                progress: 34,
                failedAttempts: 1,
              },
            },
          },
        },
      },
    });
    expect(updateCultivatorMock).toHaveBeenCalledWith(
      'cultivator-1',
      {
        condition: expect.objectContaining({
          tracks: expect.objectContaining({
            bodyCultivation: expect.objectContaining({
              realm: 'mortal_body',
              breakthrough: {
                targetRealm: 'bronze_skin',
                progress: 34,
                failedAttempts: 1,
              },
            }),
          }),
        }),
      },
      tx,
    );
    expect(consumeMaterialByIdMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      'material-1',
      1,
      tx,
    );
    expect(consumeConsumableByIdMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      'pill-1',
      1,
      tx,
    );
  });

  it('rejects body cultivation breakthrough when inventory costs are missing', async () => {
    const cultivator = createCultivator();
    cultivator.realm = '炼气';
    cultivator.condition = {
      ...cultivator.condition!,
      tracks: {
        ...cultivator.condition!.tracks,
        bodyCultivation: {
          version: 1,
          realm: 'mortal_body',
          tracks: {
            skin: { level: 4, progress: 0 },
            sinew_bone: { level: 4, progress: 0 },
            organs: { level: 4, progress: 0 },
            qi_blood: { level: 0, progress: 0 },
            primordial_spirit: { level: 0, progress: 0 },
          },
          milestones: {},
        },
      },
    };
    cultivator.inventory.materials = [
      {
        id: 'material-1',
        name: '青纹破关露',
        type: 'aux',
        rank: '玄品',
        quantity: 1,
      },
    ];
    cultivator.inventory.consumables = [];
    getCultivatorByIdMock.mockResolvedValueOnce(cultivator);

    const response = await createApp().request(
      '/api/cultivator/body-cultivation/breakthrough',
      {
        method: 'POST',
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('皮肤方向炼体丹（玄品以上） 0/1'),
    });
    expect(updateCultivatorMock).not.toHaveBeenCalled();
    expect(dbMock).not.toHaveBeenCalled();
  });
});

describe('cultivator retreat route', () => {
  let retreatLockMocks: ReturnType<typeof createRetreatLockMocks>;

  beforeEach(() => {
    vi.clearAllMocks();

    retreatLockMocks = createRetreatLockMocks();
    getRetreatLockMock.mockReturnValue(retreatLockMocks);

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
    reserveQiMock.mockResolvedValue({
      success: true,
      actionInstanceId: 'qi-action-1',
      qiBefore: 200,
      qiAfter: 195,
      consumed: 5,
    });
    commitReservationMock.mockResolvedValue(undefined);
    markNoRefundMock.mockResolvedValue(undefined);
    refundReservationMock.mockResolvedValue(undefined);
    renderPromptMock.mockReturnValue({
      system: 'system prompt',
      user: 'user prompt',
    });
    streamTextMock.mockReturnValue(
      createTextStream('灵潮翻卷，', '石门洞开。'),
    );
    mockStateOnlyTransaction({
      versionRow: createStateVersionRow({
        profileVersion: 1,
        conditionVersion: 1,
        progressVersion: 1,
        currencyVersion: 1,
      }),
      eventRows: createStateEventRows([
        {
          domain: 'progress',
          eventType: 'progress.cultivation.changed',
          patch: {
            progress: {
              cultivation_exp: 904,
            },
          },
          source: 'retreat_cultivate',
        },
      ]),
    });
  });

  it('streams a plain cultivate result without story chunks', async () => {
    const cultivator = createCultivator();
    performCultivationMock.mockReturnValue({
      cultivator: {
        ...cultivator,
        age: 42,
        closed_door_years_total: 12,
        condition: {
          ...cultivator.condition!,
          statuses: [],
        },
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
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      type: 'result',
      data: expect.objectContaining({
        action: 'cultivate',
      }),
    });
    expect(events[1]).toEqual({
      type: 'state',
      events: expect.arrayContaining([
        expect.objectContaining({
          domain: 'progress',
          source: 'retreat_cultivate',
        }),
      ]),
    });
    expect(streamTextMock).not.toHaveBeenCalled();
    expect(addRetreatRecordMock).toHaveBeenCalled();
    expect(updateCultivatorMock).toHaveBeenCalledWith(
      'cultivator-1',
      expect.objectContaining({
        age: 42,
        closed_door_years_total: 12,
        cultivation_progress: expect.any(Object),
        condition: expect.objectContaining({
          statuses: [],
        }),
      }),
      expect.any(Object),
    );
    expect(consumeLifespanAndHandleDepletionMock).toHaveBeenCalledWith(
      'cultivator-1',
      12,
      expect.objectContaining({
        deferSideEffects: true,
        ageAfterConsumption: 42,
      }),
    );
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
    expect(events[1]).toEqual({
      type: 'state',
      events: expect.any(Array),
    });
    expect(events.slice(2)).toEqual([
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
        attributeGrowth: {},
        naturalAttributeGrowth: 2,
        attributePointReward: 10,
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
    expect(events[1]).toEqual({
      type: 'state',
      events: expect.any(Array),
    });
    expect(events.slice(2)).toEqual([
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
    retreatLockMocks.acquire.mockResolvedValue(false);

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
      state: {
        cultivatorId: 'cultivator-1',
        globalVersion: 1,
        domainVersions: {
          condition: 1,
          currency: 1,
          progress: 1,
        },
        events: [
          {
            id: 1,
            cultivatorId: 'cultivator-1',
            globalVersion: 1,
            domain: 'condition',
            eventType: 'condition.recovered',
            patch: {},
            invalidates: [],
            source: 'inn_recovery',
            createdAt: '2026-06-10T00:00:00.000Z',
          },
        ],
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

describe('cultivator mail state sync route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns state events when marking a mail as read', async () => {
    getExecutorMock.mockReturnValue({
      query: {
        mails: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'mail-1',
            cultivatorId: 'cultivator-1',
            isRead: false,
          }),
        },
      },
    } as any);
    mockMailReadTransaction(2);

    const response = await createApp().request('/api/cultivator/mail/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailId: 'mail-1' }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        mailId: 'mail-1',
        unreadMailCount: 2,
      },
      state: {
        cultivatorId: 'cultivator-1',
        globalVersion: 1,
        domainVersions: {
          mail: 1,
        },
        events: [
          {
            id: 11,
            cultivatorId: 'cultivator-1',
            globalVersion: 1,
            domain: 'mail',
            eventType: 'mail.read',
            patch: {
              unreadMailCount: 2,
              mailIds: ['mail-1'],
            },
            invalidates: ['mail'],
            source: 'mail_read',
            createdAt: '2026-06-10T00:00:00.000Z',
          },
        ],
      },
    });
  });
});
