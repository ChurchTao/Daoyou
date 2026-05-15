import { Hono } from 'hono';

const {
  confirmDiscoveryCandidateMock,
  listCultivatorFormulasMock,
} = vi.hoisted(() => ({
  confirmDiscoveryCandidateMock: vi.fn(),
  listCultivatorFormulasMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator: () => async (context: any, next: () => Promise<void>) => {
    context.set('cultivator', {
      id: 'cultivator-1',
    });
    await next();
  },
}));

vi.mock('@server/lib/services/AlchemyFormulaService', () => ({
  confirmDiscoveryCandidate: confirmDiscoveryCandidateMock,
  listCultivatorFormulas: listCultivatorFormulasMock,
}));

import router from './alchemy-formulas.router';

function createApp() {
  return new Hono().route('/api/alchemy', router);
}

describe('alchemy formulas router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists cultivator formulas via GET /api/alchemy/formulas', async () => {
    listCultivatorFormulasMock.mockResolvedValueOnce([
      {
        id: '11111111-1111-4111-8111-111111111111',
        cultivatorId: 'cultivator-1',
        name: '青木疗伤丹丹方',
        family: 'healing',
        pattern: {
          requiredTags: ['healing'],
          slotCount: 1,
        },
        blueprint: {
          operations: [],
          consumeRules: {
            scene: 'out_of_battle_only',
            countsTowardLongTermQuota: false,
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
    ]);

    const response = await createApp().request('/api/alchemy/formulas');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        formulas: [
          expect.objectContaining({
            id: '11111111-1111-4111-8111-111111111111',
            name: '青木疗伤丹丹方',
          }),
        ],
      },
    });
    expect(listCultivatorFormulasMock).toHaveBeenCalledWith('cultivator-1');
  });

  it('confirms discovered formula via POST /api/alchemy/formulas/discovery/confirm', async () => {
    confirmDiscoveryCandidateMock.mockResolvedValueOnce({
      saved: true,
      formula: {
        id: '11111111-1111-4111-8111-111111111111',
        cultivatorId: 'cultivator-1',
        name: '青木疗伤丹丹方',
        family: 'healing',
        pattern: {
          requiredTags: ['healing'],
          slotCount: 1,
        },
        blueprint: {
          operations: [],
          consumeRules: {
            scene: 'out_of_battle_only',
            countsTowardLongTermQuota: false,
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
        }),
      },
    });
    expect(confirmDiscoveryCandidateMock).toHaveBeenCalledWith(
      'cultivator-1',
      '11111111-1111-4111-8111-111111111111',
      true,
    );
  });
});
