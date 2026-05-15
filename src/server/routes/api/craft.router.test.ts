import { Hono } from 'hono';

const {
  previewAlchemySelectionMock,
  previewFormulaCraftMock,
  processAlchemyCraftMock,
  craftFromFormulaMock,
} = vi.hoisted(() => ({
  previewAlchemySelectionMock: vi.fn(),
  previewFormulaCraftMock: vi.fn(),
  processAlchemyCraftMock: vi.fn(),
  craftFromFormulaMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator: () => async (context: any, next: () => Promise<void>) => {
    context.set('cultivator', {
      id: 'cultivator-1',
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

vi.mock('@server/lib/services/alchemyServiceV2', () => ({
  AlchemyServiceError: class AlchemyServiceError extends Error {
    status: number;

    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  previewAlchemySelection: previewAlchemySelectionMock,
  processAlchemyCraft: processAlchemyCraftMock,
}));

vi.mock('@server/lib/services/AlchemyFormulaService', () => ({
  craftFromFormula: craftFromFormulaMock,
  previewFormulaCraft: previewFormulaCraftMock,
}));

import craftRouter from './craft.router';

function createApp() {
  return new Hono().route('/api/craft', craftRouter);
}

describe('craft router alchemy routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores alchemy preview via GET /api/craft', async () => {
    previewAlchemySelectionMock.mockResolvedValueOnce({
      cost: { spiritStones: 6400 },
      canAfford: true,
      validation: {
        valid: true,
        warnings: ['药性稍杂。'],
      },
    });

    const response = await createApp().request(
      '/api/craft?craftType=alchemy&materialIds=m1,m2',
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
    });

    const response = await createApp().request(
      '/api/craft?craftType=alchemy&alchemyMode=formula&formulaId=11111111-1111-4111-8111-111111111111&materialIds=m1,m2',
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
      },
    });
    expect(previewFormulaCraftMock).toHaveBeenCalledWith(
      'cultivator-1',
      '11111111-1111-4111-8111-111111111111',
      ['m1', 'm2'],
      50000,
    );
  });

  it('restores alchemy crafting via POST /api/craft', async () => {
    processAlchemyCraftMock.mockResolvedValueOnce({
      consumable: {
        id: 'pill-1',
        name: '青木疗伤丹',
        type: '丹药',
        quality: '真品',
        quantity: 1,
        description: '药性平稳，可缓解伤势。',
        prompt: '疗伤为主',
        spec: {
          kind: 'pill',
          family: 'healing',
          operations: [
            { type: 'restore_resource', resource: 'hp', mode: 'flat', value: 120 },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            countsTowardLongTermQuota: false,
          },
          alchemyMeta: {
            source: 'improvised',
            sourceMaterials: ['青岚草'],
            stability: 68,
            toxicityRating: 6,
            tags: ['healing'],
          },
        },
        formulaDiscovery: {
          token: '11111111-1111-1111-1111-111111111111',
          name: '青木疗伤丹丹方',
          family: 'healing',
          patternSummary: '主药性：疗伤；炉位：1 种材料',
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
        materialQuantities: { m1: 2 },
        userPrompt: '疗伤为主',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        consumable: expect.objectContaining({
          id: 'pill-1',
          name: '青木疗伤丹',
          spec: expect.objectContaining({
            kind: 'pill',
          }),
        }),
      },
    });
    expect(processAlchemyCraftMock).toHaveBeenCalledWith('cultivator-1', ['m1'], {
      materialQuantities: { m1: 2 },
      userPrompt: '疗伤为主',
    });
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
            { type: 'restore_resource', resource: 'hp', mode: 'flat', value: 126 },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            countsTowardLongTermQuota: false,
          },
          alchemyMeta: {
            source: 'formula',
            formulaId: '11111111-1111-4111-8111-111111111111',
            sourceMaterials: ['青岚草'],
            stability: 72,
            toxicityRating: 5,
            tags: ['healing'],
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
    });
    expect(craftFromFormulaMock).toHaveBeenCalledWith(
      'cultivator-1',
      '11111111-1111-4111-8111-111111111111',
      ['m1'],
      { m1: 2 },
    );
  });
});
