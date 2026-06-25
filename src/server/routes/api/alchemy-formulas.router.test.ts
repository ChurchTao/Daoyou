import { Hono } from 'hono';

const {
  analyzeFormulaMaterialsMock,
  confirmDiscoveryCandidateMock,
  deleteCultivatorFormulaMock,
  listCultivatorFormulasPageMock,
} = vi.hoisted(() => ({
  analyzeFormulaMaterialsMock: vi.fn(),
  confirmDiscoveryCandidateMock: vi.fn(),
  deleteCultivatorFormulaMock: vi.fn(),
  listCultivatorFormulasPageMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('cultivator', {
        id: 'cultivator-1',
      });
      await next();
    },
}));

vi.mock('@server/lib/services/AlchemyFormulaService', () => ({
  analyzeFormulaMaterials: analyzeFormulaMaterialsMock,
  confirmDiscoveryCandidate: confirmDiscoveryCandidateMock,
  deleteCultivatorFormula: deleteCultivatorFormulaMock,
  listCultivatorFormulasPage: listCultivatorFormulasPageMock,
}));

import { AlchemyServiceError } from '@server/lib/services/AlchemyServiceError';
import router from './alchemy-formulas.router';

function createApp() {
  return new Hono().route('/api/alchemy', router);
}

describe('alchemy formulas router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists cultivator formulas via GET /api/alchemy/formulas', async () => {
    listCultivatorFormulasPageMock.mockResolvedValueOnce({
      formulas: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          cultivatorId: 'cultivator-1',
          name: '青木疗伤丹丹方',
          description: '此方偏于生机温养，主走木性回春之路。',
          family: 'healing',
          pattern: {
            targetPropertyVector: [{ key: 'restore_hp', weight: 0.62 }],
            slotCount: 1,
          },
          blueprint: {
            operations: [],
            consumeRules: {
              scene: 'out_of_battle_only',
              quotaCategory: 'none',
            },
            targetStability: 70,
            targetToxicity: 4,
          },
          mastery: {
            level: 0,
            exp: 0,
          },
          createdAt: '2026-05-15T00:00:00.000Z',
          updatedAt: '2026-05-15T00:00:00.000Z',
        },
      ],
      pagination: {
        page: 2,
        pageSize: 5,
        total: 6,
        totalPages: 2,
        hasPreviousPage: true,
        hasNextPage: false,
      },
    });

    const response = await createApp().request(
      '/api/alchemy/formulas?page=2&pageSize=5&search=%E9%9D%92%E6%9C%A8&family=healing',
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        formulas: [
          expect.objectContaining({
            id: '11111111-1111-4111-8111-111111111111',
            name: '青木疗伤丹丹方',
            description: '此方偏于生机温养，主走木性回春之路。',
          }),
        ],
        pagination: {
          page: 2,
          pageSize: 5,
          total: 6,
          totalPages: 2,
          hasPreviousPage: true,
          hasNextPage: false,
        },
      },
    });
    expect(listCultivatorFormulasPageMock).toHaveBeenCalledWith(
      'cultivator-1',
      {
        page: 2,
        pageSize: 5,
        search: '青木',
        family: 'healing',
      },
    );
  });

  it('confirms discovered formula via POST /api/alchemy/formulas/discovery/confirm', async () => {
    confirmDiscoveryCandidateMock.mockResolvedValueOnce({
      saved: true,
      formula: {
        id: '11111111-1111-4111-8111-111111111111',
        cultivatorId: 'cultivator-1',
        name: '青木疗伤丹丹方',
        description: '此方偏于生机温养，主走木性回春之路。',
        family: 'healing',
        pattern: {
          targetPropertyVector: [{ key: 'restore_hp', weight: 0.62 }],
          slotCount: 1,
        },
        blueprint: {
          operations: [],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'none',
          },
          targetStability: 70,
          targetToxicity: 4,
        },
        mastery: {
          level: 0,
          exp: 0,
        },
        createdAt: '2026-05-15T00:00:00.000Z',
        updatedAt: '2026-05-15T00:00:00.000Z',
      },
    });

    const response = await createApp().request(
      '/api/alchemy/formulas/discovery/confirm',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: '11111111-1111-4111-8111-111111111111',
          accept: true,
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        saved: true,
        formula: expect.objectContaining({
          id: '11111111-1111-4111-8111-111111111111',
          name: '青木疗伤丹丹方',
          description: '此方偏于生机温养，主走木性回春之路。',
        }),
      },
    });
    expect(confirmDiscoveryCandidateMock).toHaveBeenCalledWith(
      'cultivator-1',
      '11111111-1111-4111-8111-111111111111',
      true,
    );
  });

  it('analyzes selected materials for a formula via POST /api/alchemy/formulas/:formulaId/analyze', async () => {
    analyzeFormulaMaterialsMock.mockResolvedValueOnce({
      analysisId: '22222222-2222-4222-8222-222222222222',
      valid: true,
      fitScore: 0.7,
      fitBand: 'aligned',
      alignedThreshold: 0.65,
      warnings: ['炉势尚稳。'],
      materialJudgments: [
        {
          materialId: 'm1',
          materialName: '青岚草',
          verdict: 'core',
          reason: '补气回春，正合方路。',
        },
      ],
      aggregatedPropertyVector: [{ key: 'restore_hp', weight: 0.7 }],
      dominantElement: '木',
      stability: 72,
      toxicityRating: 6,
      cooldownRemainingSeconds: 60,
      expiresInSeconds: 600,
    });

    const response = await createApp().request(
      '/api/alchemy/formulas/11111111-1111-4111-8111-111111111111/analyze',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materialIds: ['m1'],
          materialQuantities: { m1: 2 },
        }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: expect.objectContaining({
        analysisId: '22222222-2222-4222-8222-222222222222',
        fitBand: 'aligned',
      }),
    });
    expect(analyzeFormulaMaterialsMock).toHaveBeenCalledWith(
      'cultivator-1',
      '11111111-1111-4111-8111-111111111111',
      ['m1'],
      { m1: 2 },
    );
  });

  it('rejects out-of-range material quantities for formula analysis', async () => {
    const response = await createApp().request(
      '/api/alchemy/formulas/11111111-1111-4111-8111-111111111111/analyze',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materialIds: ['m1'],
          materialQuantities: { m1: 999 },
        }),
      },
    );

    expect(response.status).toBe(400);
    expect(analyzeFormulaMaterialsMock).not.toHaveBeenCalled();
  });

  it('deletes a cultivator formula via DELETE /api/alchemy/formulas/:formulaId', async () => {
    deleteCultivatorFormulaMock.mockResolvedValueOnce(undefined);

    const response = await createApp().request(
      '/api/alchemy/formulas/11111111-1111-4111-8111-111111111111',
      {
        method: 'DELETE',
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: '丹方已删除',
    });
    expect(deleteCultivatorFormulaMock).toHaveBeenCalledWith(
      'cultivator-1',
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('surfaces formula deletion errors from the service layer', async () => {
    deleteCultivatorFormulaMock.mockRejectedValueOnce(
      new AlchemyServiceError('未找到这份丹方。', 404),
    );

    const response = await createApp().request(
      '/api/alchemy/formulas/11111111-1111-4111-8111-111111111111',
      {
        method: 'DELETE',
      },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: '未找到这份丹方。',
    });
  });
});
