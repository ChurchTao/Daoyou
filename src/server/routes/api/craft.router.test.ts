import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('user', { id: 'user-1' });
      context.set('cultivator', {
        id: 'cultivator-1',
        name: '林玄',
        realm: '筑基',
        realm_stage: '中期',
        spirit_stones: 50000,
      });
      await next();
    },
}));

vi.mock('@server/lib/services/creationServiceV2', () => ({
  abandonPending: vi.fn(),
  confirmCreation: vi.fn(),
  CreationServiceError: class CreationServiceError extends Error {
    status: number;

    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  estimateCost: vi.fn(),
  getPendingCreation: vi.fn(),
  previewCreationSelection: vi.fn(),
  processCreation: vi.fn(),
}));

vi.mock('@server/lib/repositories/worldChatRepository', () => ({
  createMessage: vi.fn(),
}));

vi.mock('@server/lib/services/alchemyServiceV2', () => ({
  AlchemyServiceError: class AlchemyServiceError extends Error {
    status: number;

    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  previewAlchemySelection: vi.fn(),
  processAlchemyCraft: vi.fn(),
}));

vi.mock('@server/lib/services/AlchemyFormulaService', () => ({
  craftFromFormula: vi.fn(),
  previewFormulaCraft: vi.fn(),
}));

vi.mock('@server/lib/services/TaskService', () => ({
  TaskService: {
    recordTaskEvent: vi.fn(),
  },
}));

vi.mock('@server/lib/services/QiService', () => ({
  QiInsufficientError: class QiInsufficientError extends Error {},
  QiServiceError: class QiServiceError extends Error {
    status: number;

    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  QiService: {
    reserveQi: vi.fn(),
    commitReservation: vi.fn(),
    refundReservation: vi.fn(),
  },
}));

vi.mock('@server/lib/services/PlayerStateMutationService', () => ({
  commitPlayerStateMutation: vi.fn(async (input: any) => {
    const { result, changes } = await input.run({ __tx: true });
    return {
      result,
      state: {
        cultivatorId: input.cultivatorId,
        globalVersion: 10,
        domainVersions: Object.fromEntries(
          changes.map((change: any) => [change.domain, 10]),
        ),
        events: changes.map((change: any, index: number) => ({
          id: index + 1,
          cultivatorId: input.cultivatorId,
          globalVersion: 10,
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
  toPlayerStateMutationResponse: vi.fn((committed: any) => ({
    success: true,
    data: committed.result,
    state: committed.state,
  })),
}));

vi.mock('@server/lib/services/cultivatorService', () => ({
  getCultivatorById: vi.fn(),
}));

import {
  craftFromFormula,
  previewFormulaCraft,
} from '@server/lib/services/AlchemyFormulaService';
import {
  previewAlchemySelection,
  processAlchemyCraft,
} from '@server/lib/services/alchemyServiceV2';
import {
  confirmCreation,
  processCreation,
} from '@server/lib/services/creationServiceV2';
import { getCultivatorById } from '@server/lib/services/cultivatorService';
import { QiService } from '@server/lib/services/QiService';
import { TaskService } from '@server/lib/services/TaskService';
import {
  commitPlayerStateMutation,
} from '@server/lib/services/PlayerStateMutationService';
import { createMessage } from '@server/lib/repositories/worldChatRepository';
import craftRouter from './craft.router';

const previewAlchemySelectionMock = previewAlchemySelection as unknown as Mock;
const previewFormulaCraftMock = previewFormulaCraft as unknown as Mock;
const processAlchemyCraftMock = processAlchemyCraft as unknown as Mock;
const craftFromFormulaMock = craftFromFormula as unknown as Mock;
const processCreationMock = processCreation as unknown as Mock;
const confirmCreationMock = confirmCreation as unknown as Mock;
const createMessageMock = createMessage as unknown as Mock;
const getCultivatorByIdMock = getCultivatorById as unknown as Mock;
const recordTaskEventMock = TaskService.recordTaskEvent as unknown as Mock;
const reserveQiMock = QiService.reserveQi as unknown as Mock;
const commitReservationMock = QiService.commitReservation as unknown as Mock;
const refundReservationMock = QiService.refundReservation as unknown as Mock;
const commitPlayerStateMutationMock =
  commitPlayerStateMutation as unknown as Mock;

function createApp() {
  return new Hono().route('/api/craft', craftRouter);
}

describe('craft router alchemy routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCultivatorByIdMock.mockResolvedValue({
      id: 'cultivator-1',
      pre_heaven_fates: [],
    } as any);
    recordTaskEventMock.mockResolvedValue([]);
    reserveQiMock.mockResolvedValue({
      success: true,
      actionInstanceId: 'qi-action-1',
      qiBefore: 200,
      qiAfter: 185,
      consumed: 15,
    });
    commitReservationMock.mockResolvedValue(undefined);
    refundReservationMock.mockResolvedValue(undefined);
  });

  it('restores alchemy preview via GET /api/craft', async () => {
    previewAlchemySelectionMock.mockResolvedValueOnce({
      cost: { spiritStones: 6400 },
      canAfford: true,
      validation: {
        valid: true,
        warnings: ['药性稍杂。'],
      },
      batchPreview: {
        minYield: 2,
        maxYield: 3,
        materialKindCount: 2,
        totalDose: 3,
        summary: '多材合炉，实际产量取决于药性配伍与炉势。',
        warnings: ['药性稍杂。'],
      },
    });

    const response = await createApp().request(
      `/api/craft?craftType=alchemy&materialIds=m1,m2&materialQuantities=${encodeURIComponent(JSON.stringify({ m1: 2, m2: 1 }))}`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        cost: { spiritStones: 6400 },
        canAfford: true,
        validation: {
          valid: true,
          warnings: ['药性稍杂。'],
        },
      },
    });
    expect(previewAlchemySelectionMock).toHaveBeenCalledWith(
      'cultivator-1',
      50000,
      ['m1', 'm2'],
      [],
      { m1: 2, m2: 1 },
    );
  });

  it('rejects blank alchemy prompt on POST /api/craft', async () => {
    const response = await createApp().request('/api/craft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        craftType: 'alchemy',
        materialIds: ['m1'],
        userPrompt: '   ',
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '请注入神念，描述丹药功效。',
    });
    expect(processAlchemyCraftMock).not.toHaveBeenCalled();
  });

  it('restores formula alchemy preview via GET /api/craft', async () => {
    previewFormulaCraftMock.mockResolvedValueOnce({
      cost: { spiritStones: 9200 },
      canAfford: true,
      validation: {
        valid: true,
        warnings: ['辅性药材未尽契合丹方。'],
      },
      batchPreview: {
        minYield: 2,
        maxYield: 3,
        materialKindCount: 2,
        totalDose: 3,
        summary: '多材合炉，实际产量取决于药性配伍与炉势。',
        warnings: [],
      },
    });

    const response = await createApp().request(
      `/api/craft?craftType=alchemy&alchemyMode=formula&formulaId=11111111-1111-4111-8111-111111111111&materialIds=m1,m2&materialQuantities=${encodeURIComponent(JSON.stringify({ m1: 2, m2: 1 }))}`,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        cost: { spiritStones: 9200 },
        canAfford: true,
        validation: {
          valid: true,
          warnings: ['辅性药材未尽契合丹方。'],
        },
        batchPreview: {
          minYield: 2,
          maxYield: 3,
          materialKindCount: 2,
          totalDose: 3,
          summary: '多材合炉，实际产量取决于药性配伍与炉势。',
          warnings: [],
        },
      },
    });
    expect(previewFormulaCraftMock).toHaveBeenCalledWith(
      'cultivator-1',
      '11111111-1111-4111-8111-111111111111',
      ['m1', 'm2'],
      50000,
      [],
      { m1: 2, m2: 1 },
    );
  });

  it('restores alchemy crafting via POST /api/craft', async () => {
    processAlchemyCraftMock.mockResolvedValueOnce({
      consumable: {
        id: 'pill-1',
        name: '青木疗伤丹',
        type: '丹药',
        quality: '天品',
        quantity: 1,
        description: '药性平稳，可缓解伤势。',
        prompt: '疗伤为主',
        spec: {
          kind: 'pill',
          family: 'healing',
          operations: [
            {
              type: 'restore_resource',
              resource: 'hp',
              mode: 'percent',
              value: 0.12,
            },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'none',
          },
          alchemyMeta: {
            source: 'improvised',
            sourceMaterials: ['青岚草'],
            analysisVersion: 2,
            propertyVector: [{ key: 'restore_hp', weight: 0.64 }],
            sourceMaterialVectors: [
              {
                materialRef: 'material_1',
                materialName: '青岚草',
                properties: [{ key: 'restore_hp', weight: 1 }],
              },
            ],
            stability: 68,
            toxicityRating: 6,
            tags: ['restore_hp', 'healing'],
          },
        },
      },
      formulaDiscovery: {
        token: '11111111-1111-1111-1111-111111111111',
        name: '青木疗伤丹丹方',
        description: '此方偏于生机温养，主走木性回春之路。',
        family: 'healing',
        discoveryRemark: '炉中药脉渐趋成环，这一路回春炉意已可留存。',
        patternSummary: '目标药性：补充气血 64%；炉位：1 种材料',
      },
    });

    const response = await createApp().request('/api/craft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        craftType: 'alchemy',
        materialIds: ['m1'],
        materialQuantities: { m1: 2 },
        userPrompt: '疗伤为主',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: expect.objectContaining({
        consumable: expect.objectContaining({
          id: 'pill-1',
          name: '青木疗伤丹',
          spec: expect.objectContaining({
            kind: 'pill',
          }),
        }),
        formulaDiscovery: expect.objectContaining({
          token: '11111111-1111-1111-1111-111111111111',
          name: '青木疗伤丹丹方',
          family: 'healing',
        }),
      }),
      state: expect.objectContaining({
        cultivatorId: 'cultivator-1',
        events: expect.arrayContaining([
          expect.objectContaining({
            domain: 'currency',
            eventType: 'currency.changed',
            invalidates: ['currency'],
          }),
          expect.objectContaining({
            domain: 'inventory',
            eventType: 'inventory.changed',
            invalidates: ['inventory'],
          }),
          expect.objectContaining({
            domain: 'tasks',
            eventType: 'tasks.changed',
            invalidates: ['tasks'],
          }),
        ]),
      }),
    });
    expect(processAlchemyCraftMock).toHaveBeenCalledWith(
      'cultivator-1',
      ['m1'],
      {
        materialQuantities: { m1: 2 },
        userPrompt: '疗伤为主',
        tx: { __tx: true },
      },
    );
    expect(reserveQiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cultivatorId: 'cultivator-1',
        action: 'alchemy_improvised',
        metadata: expect.objectContaining({
          craftType: 'alchemy',
          alchemyMode: 'improvised',
          materialCount: 1,
        }),
      }),
    );
    expect(commitReservationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionInstanceId: expect.any(String),
      }),
    );
    expect(recordTaskEventMock).toHaveBeenCalledWith(
      'cultivator-1',
      'alchemy_crafted',
      { tx: { __tx: true } },
    );
    expect(commitPlayerStateMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        source: 'alchemy_improvised',
      }),
    );
    expect(createMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        senderCultivatorId: null,
        senderName: '修仙界传闻',
        senderRealmStage: '系统',
        messageType: 'item_showcase',
        payload: expect.objectContaining({
          itemType: 'consumable',
          itemId: 'pill-1',
          text: '由林玄炼成，丹品已入天品，药香化霞，足令诸修侧目。',
          snapshot: expect.objectContaining({
            id: 'pill-1',
            name: '青木疗伤丹',
            quality: '天品',
            quantity: 1,
          }),
        }),
      }),
    );
  });

  it('does not broadcast alchemy results below heaven quality', async () => {
    processAlchemyCraftMock.mockResolvedValueOnce({
      consumable: {
        id: 'pill-low',
        name: '青木疗伤丹',
        type: '丹药',
        quality: '真品',
        quantity: 1,
        description: '药性平稳，可缓解伤势。',
        spec: {
          kind: 'pill',
          family: 'healing',
          operations: [
            {
              type: 'restore_resource',
              resource: 'hp',
              mode: 'percent',
              value: 0.08,
            },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'none',
          },
          alchemyMeta: {
            source: 'improvised',
            sourceMaterials: ['青岚草'],
            analysisVersion: 2,
            propertyVector: [{ key: 'restore_hp', weight: 0.5 }],
            sourceMaterialVectors: [],
            stability: 60,
            toxicityRating: 8,
            tags: ['restore_hp', 'healing'],
          },
        },
      },
    });

    const response = await createApp().request('/api/craft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        craftType: 'alchemy',
        materialIds: ['m1'],
        materialQuantities: { m1: 1 },
        userPrompt: '疗伤为主',
      }),
    });

    expect(response.status).toBe(200);
    expect(createMessageMock).not.toHaveBeenCalled();
  });

  it('routes formula crafting via POST /api/craft', async () => {
    craftFromFormulaMock.mockResolvedValueOnce({
      consumable: {
        id: 'pill-2',
        name: '青木疗伤丹',
        type: '丹药',
        quality: '真品',
        quantity: 1,
        spec: {
          kind: 'pill',
          family: 'healing',
          operations: [
            {
              type: 'restore_resource',
              resource: 'hp',
              mode: 'percent',
              value: 0.126,
            },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'none',
          },
          alchemyMeta: {
            source: 'formula',
            formulaId: '11111111-1111-4111-8111-111111111111',
            sourceMaterials: ['青岚草'],
            analysisVersion: 2,
            propertyVector: [{ key: 'restore_hp', weight: 0.64 }],
            sourceMaterialVectors: [
              {
                materialRef: 'material_1',
                materialName: '青岚草',
                properties: [{ key: 'restore_hp', weight: 1 }],
              },
            ],
            fitScore: 1,
            fitBand: 'aligned',
            fitMultiplier: 1.05,
            stability: 72,
            toxicityRating: 5,
            tags: ['restore_hp', 'healing'],
          },
        },
      },
      formulaProgress: {
        previousLevel: 0,
        level: 0,
        exp: 1,
        gainedExp: 1,
        leveledUp: false,
      },
    });

    const response = await createApp().request('/api/craft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        craftType: 'alchemy',
        alchemyMode: 'formula',
        formulaId: '11111111-1111-4111-8111-111111111111',
        analysisId: '22222222-2222-4222-8222-222222222222',
        materialIds: ['m1'],
        materialQuantities: { m1: 2 },
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        consumable: expect.objectContaining({
          id: 'pill-2',
          name: '青木疗伤丹',
        }),
        formulaProgress: {
          previousLevel: 0,
          level: 0,
          exp: 1,
          gainedExp: 1,
          leveledUp: false,
        },
      },
      state: expect.objectContaining({
        cultivatorId: 'cultivator-1',
        events: expect.arrayContaining([
          expect.objectContaining({
            domain: 'currency',
            eventType: 'currency.changed',
          }),
          expect.objectContaining({
            domain: 'inventory',
            eventType: 'inventory.changed',
          }),
          expect.objectContaining({
            domain: 'tasks',
            eventType: 'tasks.changed',
          }),
        ]),
      }),
    });
    expect(craftFromFormulaMock).toHaveBeenCalledWith(
      'cultivator-1',
      '11111111-1111-4111-8111-111111111111',
      ['m1'],
      { m1: 2 },
      '22222222-2222-4222-8222-222222222222',
      {
        tx: { __tx: true },
        deferSideEffects: true,
      },
    );
    expect(reserveQiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cultivatorId: 'cultivator-1',
        action: 'alchemy_formula',
        metadata: expect.objectContaining({
          craftType: 'alchemy',
          alchemyMode: 'formula',
          formulaId: '11111111-1111-4111-8111-111111111111',
          materialCount: 1,
        }),
      }),
    );
    expect(commitReservationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionInstanceId: expect.any(String),
      }),
    );
    expect(recordTaskEventMock).toHaveBeenCalledWith(
      'cultivator-1',
      'alchemy_crafted',
      { tx: { __tx: true } },
    );
    expect(commitPlayerStateMutationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        source: 'alchemy_formula',
      }),
    );
  });

  it('requires analysisId for formula crafting via POST /api/craft', async () => {
    const response = await createApp().request('/api/craft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        craftType: 'alchemy',
        alchemyMode: 'formula',
        formulaId: '11111111-1111-4111-8111-111111111111',
        materialIds: ['m1'],
        materialQuantities: { m1: 2 },
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: '请先推演药路。',
    });
    expect(craftFromFormulaMock).not.toHaveBeenCalled();
    expect(reserveQiMock).not.toHaveBeenCalled();
  });

  it('rolls back transaction-scoped qi reservation when crafting throws', async () => {
    processAlchemyCraftMock.mockRejectedValueOnce(new Error('LLM unavailable'));

    const response = await createApp().request('/api/craft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        craftType: 'alchemy',
        materialIds: ['m1'],
        materialQuantities: { m1: 1 },
        userPrompt: '疗伤为主',
      }),
    });

    expect(response.status).toBe(500);
    expect(reserveQiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'alchemy_improvised',
      }),
    );
    expect(refundReservationMock).not.toHaveBeenCalled();
    expect(commitReservationMock).not.toHaveBeenCalled();
  });
});

describe('craft router creation broadcasts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reserveQiMock.mockResolvedValue({
      success: true,
      actionInstanceId: 'qi-action-1',
      qiBefore: 200,
      qiAfter: 192,
      consumed: 8,
    });
    commitReservationMock.mockResolvedValue(undefined);
    createMessageMock.mockResolvedValue({
      id: 'chat-1',
      channel: 'world',
    });
  });

  function creationResult(overrides: Record<string, unknown> = {}) {
    return {
      id: 'product-1',
      productType: 'artifact',
      name: '玄雷剑胚',
      description: '雷光隐现。',
      element: '雷',
      quality: '天品',
      slot: 'weapon',
      score: 1200,
      productModel: {
        productType: 'artifact',
        name: '玄雷剑胚',
        projectionQuality: '天品',
      },
      affixes: [],
      ...overrides,
    };
  }

  it('broadcasts a system item showcase when high-tier creation is inserted directly', async () => {
    processCreationMock.mockResolvedValueOnce(creationResult());

    const response = await createApp().request('/api/craft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        craftType: 'refine',
        materialIds: ['m1'],
        requestedSlot: 'weapon',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: 'product-1',
          quality: '天品',
        }),
      }),
    );
    expect(createMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        senderCultivatorId: null,
        senderName: '修仙界传闻',
        senderRealmStage: '系统',
        messageType: 'item_showcase',
        payload: expect.objectContaining({
          itemType: 'artifact',
          itemId: 'product-1',
          text: '由林玄炼成，品阶已入天品，灵韵自生，足令诸修侧目。',
          snapshot: expect.objectContaining({
            id: 'product-1',
            name: '玄雷剑胚',
            quality: '天品',
          }),
        }),
      }),
    );
  });

  it('does not broadcast creation below heaven quality', async () => {
    processCreationMock.mockResolvedValueOnce(
      creationResult({
        quality: '地品',
        productModel: {
          productType: 'artifact',
          name: '玄雷剑胚',
          projectionQuality: '地品',
        },
      }),
    );

    const response = await createApp().request('/api/craft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        craftType: 'refine',
        materialIds: ['m1'],
        requestedSlot: 'weapon',
      }),
    });

    expect(response.status).toBe(200);
    expect(createMessageMock).not.toHaveBeenCalled();
  });

  it('does not broadcast pending replacement results before they are inserted', async () => {
    processCreationMock.mockResolvedValueOnce(
      creationResult({
        id: '',
        productType: 'skill',
        slot: null,
        needs_replace: true,
      }),
    );

    const response = await createApp().request('/api/craft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        craftType: 'create_skill',
        materialIds: ['m1'],
      }),
    });

    expect(response.status).toBe(200);
    expect(createMessageMock).not.toHaveBeenCalled();
  });

  it('broadcasts high-tier creation after replacement confirmation inserts it', async () => {
    confirmCreationMock.mockResolvedValueOnce(
      creationResult({
        id: 'skill-1',
        productType: 'skill',
        element: '雷',
        slot: null,
      }),
    );

    const response = await createApp().request('/api/craft/confirm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        craftType: 'create_skill',
        replaceId: null,
      }),
    });

    expect(response.status).toBe(200);
    expect(createMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messageType: 'item_showcase',
        payload: expect.objectContaining({
          itemType: 'skill',
          itemId: 'skill-1',
          snapshot: expect.objectContaining({
            productType: 'skill',
            quality: '天品',
          }),
        }),
      }),
    );
  });

  it('keeps creation response successful when world chat broadcast fails', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    processCreationMock.mockResolvedValueOnce(creationResult());
    createMessageMock.mockRejectedValueOnce(new Error('redis unavailable'));

    const response = await createApp().request('/api/craft', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        craftType: 'refine',
        materialIds: ['m1'],
        requestedSlot: 'weapon',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
      }),
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '造物传闻发送失败:',
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });
});
