const {
  addConsumableToInventoryMock,
  analyzerAnalyzeMock,
  executorState,
  getCultivatorByIdUnsafeMock,
  getExecutorMock,
  redisGetMock,
  redisDelMock,
  redisSetMock,
  redisTtlMock,
} = vi.hoisted(() => {
  const state = {
    consumableRows: [] as any[],
    cultivatorRow: null as any,
    formulaRows: [] as any[],
    materialRows: [] as any[],
  };

  const tx = {
    delete() {
      return {
        where: async () => undefined,
      };
    },
    update() {
      return {
        set() {
          return {
            where: async () => undefined,
          };
        },
      };
    },
  };

  const executor = {
    select() {
      return {
        from(table: unknown) {
          if (
            table &&
            typeof table === 'object' &&
            'family' in table &&
            'pattern' in table &&
            'blueprint' in table
          ) {
            return {
              where() {
                return {
                  limit: async () => state.formulaRows,
                };
              },
            };
          }

          if (
            table &&
            typeof table === 'object' &&
            'rank' in table &&
            'description' in table
          ) {
            return {
              where: async () => state.materialRows,
            };
          }

          if (
            table &&
            typeof table === 'object' &&
            'realm' in table &&
            'spirit_stones' in table
          ) {
            return {
              where() {
                return {
                  limit: async () =>
                    state.cultivatorRow ? [state.cultivatorRow] : [],
                };
              },
            };
          }

          if (
            table &&
            typeof table === 'object' &&
            'quality' in table &&
            'spec' in table
          ) {
            return {
              where() {
                return {
                  limit: async () => state.consumableRows,
                };
              },
            };
          }

          throw new Error('unexpected table');
        },
      };
    },
    transaction: async (callback: (tx: any) => Promise<void>) => callback(tx),
  };

  return {
    addConsumableToInventoryMock: vi.fn(),
    analyzerAnalyzeMock: vi.fn(),
    executorState: state,
    getCultivatorByIdUnsafeMock: vi.fn((cultivatorId: string) =>
      Promise.resolve(
        state.cultivatorRow
          ? {
              cultivator: {
                id: cultivatorId,
                realm: state.cultivatorRow.realm,
                pre_heaven_fates: [],
              },
              userId: state.cultivatorRow.userId ?? 'user-1',
              updatedAt: new Date('2026-05-15T00:00:00.000Z'),
            }
          : null,
      ),
    ),
    getExecutorMock: vi.fn(() => executor),
    redisGetMock: vi.fn(),
    redisDelMock: vi.fn(),
    redisSetMock: vi.fn(),
    redisTtlMock: vi.fn(),
  };
});

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

vi.mock('@server/lib/redis', () => ({
  redis: {
    del: redisDelMock,
    get: redisGetMock,
    set: redisSetMock,
    ttl: redisTtlMock,
  },
}));

vi.mock('./cultivatorService', () => ({
  addConsumableToInventory: addConsumableToInventoryMock,
  getCultivatorByIdUnsafe: getCultivatorByIdUnsafeMock,
}));

vi.mock('./AlchemyFormulaAnalyzer', () => ({
  alchemyFormulaAnalyzer: {
    analyze: analyzerAnalyzeMock,
  },
}));

import type { PillSpec } from '@shared/types/consumable';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  analyzeFormulaMaterials,
  craftFromFormula,
  previewFormulaCraft,
} from './AlchemyFormulaService';

function createAnalysisPayload(
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    cultivatorId: 'cultivator-1',
    formulaId: 'formula-1',
    formulaMasteryLevel: 2,
    signature: JSON.stringify({
      cultivatorId: 'cultivator-1',
      formulaId: 'formula-1',
      formulaMasteryLevel: 2,
      materials: [{ dose: 1, id: 'm1' }],
    }),
    plan: {
      materialVectors: [
        {
          materialRef: 'material_1',
          materialName: '回春草',
          properties: [
            { key: 'restore_hp', weight: 0.62 },
            { key: 'heal_wounds', weight: 0.38 },
          ],
        },
      ],
      intentVector: [],
      focusMode: 'balanced',
      requestedElementBias: '木',
    },
    fitScore: 1,
    fitBand: 'aligned',
    hardBlockThreshold: 0.42,
    alignedThreshold: 0.65,
    warnings: [],
    materialJudgments: [
      {
        materialId: 'm1',
        materialName: '回春草',
        verdict: 'core',
        reason: '补气回春，正合方路。',
      },
    ],
    aggregatedPropertyVector: [
      { key: 'restore_hp', weight: 0.62 },
      { key: 'heal_wounds', weight: 0.38 },
    ],
    dominantElement: '木',
    stability: 80,
    toxicityRating: 6,
    ...overrides,
  };
}

describe('craftFromFormula narrative copy', () => {
  beforeEach(() => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    executorState.formulaRows = [
      {
        id: 'formula-1',
        cultivatorId: 'cultivator-1',
        name: '回春丹方',
        description: '此方偏走木性生机，炉势圆融而不躁进。',
        family: 'healing',
        pattern: {
          targetPropertyVector: [
            { key: 'restore_hp', weight: 0.62 },
            { key: 'heal_wounds', weight: 0.38 },
          ],
          dominantElement: '木',
          minQuality: '真品',
          slotCount: 1,
        },
        blueprint: {
          operations: [
            {
              type: 'restore_resource',
              resource: 'hp',
              mode: 'percent',
              value: 0.12,
            },
            { type: 'change_gauge', gauge: 'pillToxicity', delta: 4 },
            { type: 'remove_status', status: 'minor_wound' },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'none',
          },
          targetStability: 78,
          targetToxicity: 6,
        },
        mastery: {
          level: 2,
          exp: 1,
        },
        createdAt: new Date('2026-05-15T00:00:00.000Z'),
        updatedAt: new Date('2026-05-15T00:00:00.000Z'),
      },
    ];
    executorState.materialRows = [
      {
        id: 'm1',
        cultivatorId: 'cultivator-1',
        name: '回春草',
        description: '草叶温润，可补充气血并治愈伤口。',
        rank: '真品',
        quantity: 1,
        element: '木',
        type: 'herb',
      },
    ];
    executorState.cultivatorRow = {
      id: 'cultivator-1',
      userId: 'user-1',
      realm: '筑基',
      spirit_stones: 50000,
    };
    executorState.consumableRows = [];
    redisSetMock.mockReset();
    redisTtlMock.mockReset();
    redisGetMock.mockReset();
    redisDelMock.mockReset();
    addConsumableToInventoryMock.mockReset();
    analyzerAnalyzeMock.mockReset();
    getCultivatorByIdUnsafeMock.mockClear();
    redisSetMock.mockResolvedValue('OK');
    redisTtlMock.mockResolvedValue(37);
    redisGetMock.mockResolvedValue(JSON.stringify(createAnalysisPayload()));
    analyzerAnalyzeMock.mockResolvedValue({
      plan: createAnalysisPayload().plan,
      materialJudgments: createAnalysisPayload().materialJudgments,
    });
  });

  it('passes full formula context into manual formula analysis', async () => {
    const result = await analyzeFormulaMaterials(
      'cultivator-1',
      'formula-1',
      ['m1'],
      { m1: 1 },
    );

    expect(result.valid).toBe(true);
    expect(result.fitBand).toBe('aligned');
    expect(result.cooldownRemainingSeconds).toBe(30);
    expect(redisSetMock).toHaveBeenNthCalledWith(
      1,
      'alchemy:formula_analysis:cooldown:cultivator-1',
      '1',
      'EX',
      30,
      'NX',
    );
    expect(analyzerAnalyzeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        formula: expect.objectContaining({
          id: 'formula-1',
          name: '回春丹方',
          description: '此方偏走木性生机，炉势圆融而不躁进。',
          mastery: expect.objectContaining({ level: 2 }),
        }),
        materials: [
          expect.objectContaining({
            id: 'm1',
            materialRef: 'material_1',
            name: '回春草',
            dose: 1,
          }),
        ],
      }),
    );
  });

  it('enforces the per-cultivator analyze cooldown and returns remaining seconds', async () => {
    redisSetMock.mockResolvedValueOnce(null);
    redisTtlMock.mockResolvedValueOnce(37);

    await expect(
      analyzeFormulaMaterials('cultivator-1', 'formula-1', ['m1'], { m1: 1 }),
    ).rejects.toMatchObject({
      message: '请 37 秒后再按方辨材。',
      status: 429,
      details: {
        remainingSeconds: 37,
      },
    });
    expect(analyzerAnalyzeMock).not.toHaveBeenCalled();
  });

  it('lowers the hard block threshold with mastery without changing fit score', async () => {
    analyzerAnalyzeMock.mockResolvedValue({
      plan: {
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '回春草',
            properties: [
              { key: 'restore_hp', weight: 0.4 },
              { key: 'restore_mp', weight: 0.6 },
            ],
          },
        ],
        intentVector: [],
        focusMode: 'balanced',
        requestedElementBias: '木',
      },
      materialJudgments: createAnalysisPayload().materialJudgments,
    });
    executorState.formulaRows = [
      {
        ...executorState.formulaRows[0],
        mastery: {
          level: 0,
          exp: 0,
        },
      },
    ];

    const noviceResult = await analyzeFormulaMaterials(
      'cultivator-1',
      'formula-1',
      ['m1'],
      { m1: 1 },
    );

    executorState.formulaRows = [
      {
        ...executorState.formulaRows[0],
        mastery: {
          level: 4,
          exp: 0,
        },
      },
    ];

    const veteranResult = await analyzeFormulaMaterials(
      'cultivator-1',
      'formula-1',
      ['m1'],
      { m1: 1 },
    );

    expect(noviceResult.fitScore).toBeCloseTo(0.4, 4);
    expect(veteranResult.fitScore).toBeCloseTo(0.4, 4);
    expect(noviceResult.hardBlockThreshold).toBeCloseTo(0.45, 4);
    expect(veteranResult.hardBlockThreshold).toBeCloseTo(0.39, 4);
    expect(noviceResult.fitBand).toBe('blocked');
    expect(veteranResult.fitBand).toBe('degraded');
  });

  it('keeps formula-derived pill name and uses rule-based batch description', async () => {
    const result = await craftFromFormula(
      'cultivator-1',
      'formula-1',
      ['m1'],
      undefined,
      'analysis-1',
    );

    expect(result.consumable.name).toBe('回春');
    expect(result.consumable.description).toContain('依《回春丹方》炉意炼成');
    expect(result.consumable.description).toContain('药力拟合 115%');
  });

  it('rejects formula crafting without a valid prior analysis id', async () => {
    await expect(
      craftFromFormula('cultivator-1', 'formula-1', ['m1']),
    ).rejects.toThrow('请先按方辨材。');
  });

  it('rejects mystery materials during formula preview, analysis, and crafting', async () => {
    executorState.materialRows = [
      {
        ...executorState.materialRows[0],
        details: {
          mystery: {
            mysteryId: 'mystery-1',
            identifyCost: 200,
            disguiseTier: '玄品',
            purchasedAt: Date.now(),
          },
        },
      },
    ];

    const preview = await previewFormulaCraft(
      'cultivator-1',
      'formula-1',
      ['m1'],
      50000,
    );
    expect(preview.validation).toMatchObject({
      valid: false,
      blockingReason: '待鉴定材料无法入炉，请先鉴定。',
    });

    const analysis = await analyzeFormulaMaterials(
      'cultivator-1',
      'formula-1',
      ['m1'],
    );
    expect(analysis).toMatchObject({
      valid: false,
      staticBlockingReason: '待鉴定材料无法入炉，请先鉴定。',
      fitBand: 'blocked',
    });
    expect(analyzerAnalyzeMock).not.toHaveBeenCalled();

    await expect(
      craftFromFormula(
        'cultivator-1',
        'formula-1',
        ['m1'],
        undefined,
        'analysis-1',
      ),
    ).rejects.toThrow('待鉴定材料无法入炉，请先鉴定。');
  });

  it('rejects formula crafting when the cached analysis has expired', async () => {
    redisGetMock.mockResolvedValueOnce(null);

    await expect(
      craftFromFormula(
        'cultivator-1',
        'formula-1',
        ['m1'],
        undefined,
        'analysis-1',
      ),
    ).rejects.toThrow('请先按方辨材。');
  });

  it('rejects formula crafting when the cached analysis signature no longer matches', async () => {
    redisGetMock.mockResolvedValueOnce(
      JSON.stringify(
        createAnalysisPayload({
          signature: 'mismatch-signature',
        }),
      ),
    );

    await expect(
      craftFromFormula(
        'cultivator-1',
        'formula-1',
        ['m1'],
        undefined,
        'analysis-1',
      ),
    ).rejects.toThrow('请先按方辨材。');
  });

  it('rejects materials whose fit drops below the hard threshold', async () => {
    redisGetMock.mockResolvedValueOnce(
      JSON.stringify(
        createAnalysisPayload({
          plan: {
            materialVectors: [
              {
                materialRef: 'material_1',
                materialName: '回春草',
                properties: [{ key: 'restore_mp', weight: 1 }],
              },
            ],
            intentVector: [],
            focusMode: 'balanced',
            requestedElementBias: '木',
          },
          fitScore: 0,
          fitBand: 'blocked',
        }),
      ),
    );

    await expect(
      craftFromFormula(
        'cultivator-1',
        'formula-1',
        ['m1'],
        undefined,
        'analysis-1',
      ),
    ).rejects.toThrow('本炉药性与丹方偏差过大，强行开炉只会炸鼎。');
  });

  it('normalizes healing wound removal by the current crafted quality', async () => {
    executorState.cultivatorRow = {
      ...executorState.cultivatorRow,
      spirit_stones: 100000,
    };
    executorState.materialRows = [
      {
        ...executorState.materialRows[0],
        rank: '天品',
      },
    ];

    const result = await craftFromFormula(
      'cultivator-1',
      'formula-1',
      ['m1'],
      undefined,
      'analysis-1',
    );

    expect(result.consumable.quality).toBe('天品');
    expect(result.consumable.spec.kind).toBe('pill');
    expect((result.consumable.spec as PillSpec).operations).toContainEqual({
      type: 'remove_status',
      status: 'near_death',
    });
  });

  it('converts legacy cultivation gain blueprints into retreat boost pills', async () => {
    executorState.formulaRows = [
      {
        ...executorState.formulaRows[0],
        name: '养元丹方',
        description: '此方偏收金水养气之势，重在缓积道基。',
        family: 'cultivation',
        pattern: {
          targetPropertyVector: [{ key: 'cultivation', weight: 1 }],
          slotCount: 1,
        },
        blueprint: {
          operations: [
            { type: 'gain_progress', target: 'cultivation_exp', value: 9999 },
            { type: 'change_gauge', gauge: 'pillToxicity', delta: 9 },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'cultivation',
          },
          targetStability: 72,
          targetToxicity: 9,
        },
      },
    ];
    executorState.materialRows = [
      {
        ...executorState.materialRows[0],
        name: '金霞芝',
        description: '芝气温养，可积蓄修为。',
        element: '金',
      },
    ];
    redisGetMock.mockResolvedValueOnce(
      JSON.stringify(
        createAnalysisPayload({
          plan: {
            materialVectors: [
              {
                materialRef: 'material_1',
                materialName: '金霞芝',
                properties: [{ key: 'cultivation', weight: 1 }],
              },
            ],
            intentVector: [],
            focusMode: 'balanced',
          },
          aggregatedPropertyVector: [{ key: 'cultivation', weight: 1 }],
          fitScore: 1,
          fitBand: 'aligned',
        }),
      ),
    );
    executorState.cultivatorRow = {
      ...executorState.cultivatorRow,
      realm: '筑基',
      realm_stage: '后期',
      cultivation_progress: {
        exp_cap: 5000,
      },
    };

    const result = await craftFromFormula(
      'cultivator-1',
      'formula-1',
      ['m1'],
      undefined,
      'analysis-1',
    );

    expect(result.consumable.name).toBe('养元');
    expect(result.consumable.spec.kind).toBe('pill');
    expect(
      (result.consumable.spec as PillSpec).consumeRules.quotaCategory,
    ).toBe('cultivation');
    expect((result.consumable.spec as PillSpec).operations).toContainEqual({
      type: 'add_status',
      status: 'cultivation_boost',
      usesRemaining: 1,
      payload: {
        boostPercent: 1.5695,
        retreatExpMultiplier: 2.5695,
      },
    });
    expect((result.consumable.spec as PillSpec).operations).toContainEqual({
      type: 'change_gauge',
      gauge: 'pillToxicity',
      delta: 19,
    });
    expect((result.consumable.spec as PillSpec).alchemyMeta.appearance).toBe(
      'middle',
    );
    expect(
      (result.consumable.spec as PillSpec).operations.some(
        (operation) =>
          operation.type === 'gain_progress' &&
          operation.target === 'cultivation_exp',
      ),
    ).toBe(false);
  });

  it('scales longevity formula lifespan gains and keeps the isolated longevity quota', async () => {
    executorState.formulaRows = [
      {
        ...executorState.formulaRows[0],
        name: '延寿丹方',
        description: '此方偏走木性生机，专为固本延寿。',
        family: 'longevity',
        pattern: {
          targetPropertyVector: [{ key: 'extend_lifespan', weight: 1 }],
          slotCount: 1,
        },
        blueprint: {
          operations: [
            { type: 'increase_lifespan', value: 50 },
            { type: 'change_gauge', gauge: 'pillToxicity', delta: 9 },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'long_term',
          },
          targetStability: 76,
          targetToxicity: 9,
        },
      },
    ];
    executorState.materialRows = [
      {
        ...executorState.materialRows[0],
        name: '寿元果',
        description: '果中生机绵长，可固本延寿，续补命元。',
        element: '木',
      },
    ];
    redisGetMock.mockResolvedValueOnce(
      JSON.stringify(
        createAnalysisPayload({
          plan: {
            materialVectors: [
              {
                materialRef: 'material_1',
                materialName: '寿元果',
                properties: [{ key: 'extend_lifespan', weight: 1 }],
              },
            ],
            intentVector: [],
            focusMode: 'balanced',
          },
          aggregatedPropertyVector: [{ key: 'extend_lifespan', weight: 1 }],
          fitScore: 1,
          fitBand: 'aligned',
        }),
      ),
    );

    const result = await craftFromFormula(
      'cultivator-1',
      'formula-1',
      ['m1'],
      undefined,
      'analysis-1',
    );

    expect(result.consumable.name).toBe('延寿');
    expect(result.consumable.spec.kind).toBe('pill');
    expect(
      (result.consumable.spec as PillSpec).consumeRules.quotaCategory,
    ).toBe('longevity');
    expect((result.consumable.spec as PillSpec).operations).toContainEqual({
      type: 'increase_lifespan',
      value: 104,
    });
  });

  it('preserves clear_mind status effects when crafting breakthrough formulas', async () => {
    executorState.formulaRows = [
      {
        ...executorState.formulaRows[0],
        name: '清心护婴丹方',
        description: '此方以清心定神为先，专为护住婴劫前的识海。',
        family: 'breakthrough',
        pattern: {
          targetPropertyVector: [{ key: 'clear_mind_support', weight: 1 }],
          slotCount: 1,
        },
        blueprint: {
          operations: [
            { type: 'add_status', status: 'clear_mind', usesRemaining: 1 },
            { type: 'change_gauge', gauge: 'pillToxicity', delta: 9 },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'long_term',
          },
          targetStability: 74,
          targetToxicity: 9,
        },
      },
    ];
    executorState.materialRows = [
      {
        ...executorState.materialRows[0],
        name: '静神芝',
        description: '芝气清宁，可助清心定神，稳住识海。',
        element: '水',
      },
    ];
    redisGetMock.mockResolvedValueOnce(
      JSON.stringify(
        createAnalysisPayload({
          plan: {
            materialVectors: [
              {
                materialRef: 'material_1',
                materialName: '静神芝',
                properties: [{ key: 'clear_mind_support', weight: 1 }],
              },
            ],
            intentVector: [],
            focusMode: 'balanced',
          },
          aggregatedPropertyVector: [{ key: 'clear_mind_support', weight: 1 }],
          fitScore: 1,
          fitBand: 'aligned',
        }),
      ),
    );
    executorState.cultivatorRow = {
      ...executorState.cultivatorRow,
      realm: '金丹',
    };

    const result = await craftFromFormula(
      'cultivator-1',
      'formula-1',
      ['m1'],
      undefined,
      'analysis-1',
    );

    expect(result.consumable.name).toBe('清心护婴');
    expect(result.consumable.spec.kind).toBe('pill');
    expect(
      (result.consumable.spec as PillSpec).consumeRules.quotaCategory,
    ).toBe('none');
    expect((result.consumable.spec as PillSpec).operations).toContainEqual({
      type: 'add_status',
      status: 'clear_mind',
      usesRemaining: 2,
      payload: {
        preventsInnerDemon: true,
      },
    });
    expect((result.consumable.spec as PillSpec).alchemyMeta).toMatchObject({
      breakthroughTargetRealm: '元婴',
      propertyVector: [{ key: 'clear_mind_support', weight: 1 }],
    });
    expect(
      (result.consumable.spec as PillSpec).alchemyMeta.breakthroughLabel,
    ).toBeUndefined();
  });

  it('preserves protect_meridians status effects when crafting higher-realm breakthrough formulas', async () => {
    executorState.formulaRows = [
      {
        ...executorState.formulaRows[0],
        name: '稳络叩神丹方',
        description: '此方重在护脉稳络，专为化神前的大境界冲关所备。',
        family: 'breakthrough',
        pattern: {
          targetPropertyVector: [
            { key: 'protect_meridians_support', weight: 1 },
          ],
          slotCount: 1,
        },
        blueprint: {
          operations: [
            {
              type: 'add_status',
              status: 'protect_meridians',
              usesRemaining: 1,
            },
            { type: 'change_gauge', gauge: 'pillToxicity', delta: 11 },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'long_term',
          },
          targetStability: 72,
          targetToxicity: 11,
        },
      },
    ];
    executorState.materialRows = [
      {
        ...executorState.materialRows[0],
        name: '护络藤',
        description: '藤性绵长，可护脉稳络，镇住冲关时经脉震荡。',
        element: '木',
      },
    ];
    redisGetMock.mockResolvedValueOnce(
      JSON.stringify(
        createAnalysisPayload({
          plan: {
            materialVectors: [
              {
                materialRef: 'material_1',
                materialName: '护络藤',
                properties: [{ key: 'protect_meridians_support', weight: 1 }],
              },
            ],
            intentVector: [],
            focusMode: 'balanced',
          },
          aggregatedPropertyVector: [
            { key: 'protect_meridians_support', weight: 1 },
          ],
          fitScore: 1,
          fitBand: 'aligned',
        }),
      ),
    );
    executorState.cultivatorRow = {
      ...executorState.cultivatorRow,
      realm: '元婴',
    };

    const result = await craftFromFormula(
      'cultivator-1',
      'formula-1',
      ['m1'],
      undefined,
      'analysis-1',
    );

    expect(result.consumable.name).toBe('稳络叩神');
    expect(result.consumable.spec.kind).toBe('pill');
    expect(
      (result.consumable.spec as PillSpec).consumeRules.quotaCategory,
    ).toBe('none');
    expect((result.consumable.spec as PillSpec).operations).toContainEqual({
      type: 'add_status',
      status: 'protect_meridians',
      usesRemaining: 1,
      payload: {
        failureExpLossReductionPercent: 0.4764,
      },
    });
    expect((result.consumable.spec as PillSpec).alchemyMeta).toMatchObject({
      breakthroughTargetRealm: '化神',
      propertyVector: [{ key: 'protect_meridians_support', weight: 1 }],
    });
    expect(
      (result.consumable.spec as PillSpec).alchemyMeta.breakthroughLabel,
    ).toBeUndefined();
  });

  it('uses formula product names when crafting body formulas', async () => {
    executorState.formulaRows = [
      {
        ...executorState.formulaRows[0],
        name: '真火炼脏丹方',
        family: 'tempering',
        pattern: {
          targetPropertyVector: [{ key: 'body_organs', weight: 1 }],
          dominantElement: '火',
          minQuality: '真品',
          slotCount: 1,
        },
        blueprint: {
          operations: [
            {
              type: 'advance_track',
              track: 'body.organs',
              value: 130,
            },
            { type: 'change_gauge', gauge: 'pillToxicity', delta: 22 },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'long_term',
          },
          targetStability: 58,
          targetToxicity: 22,
        },
      },
    ];
    executorState.materialRows = [
      {
        ...executorState.materialRows[0],
        name: '真火莲',
        description: '火性入脏，可煅五腑。',
        element: '火',
      },
    ];
    redisGetMock.mockResolvedValueOnce(
      JSON.stringify(
        createAnalysisPayload({
          plan: {
            materialVectors: [
              {
                materialRef: 'material_1',
                materialName: '真火莲',
                properties: [{ key: 'body_organs', weight: 1 }],
              },
            ],
            intentVector: [],
            focusMode: 'balanced',
            requestedElementBias: '火',
          },
          aggregatedPropertyVector: [{ key: 'body_organs', weight: 1 }],
          dominantElement: '火',
          stability: 58,
          toxicityRating: 22,
        }),
      ),
    );

    const result = await craftFromFormula(
      'cultivator-1',
      'formula-1',
      ['m1'],
      undefined,
      'analysis-1',
    );

    expect(result.consumable.name).toBe('真火炼脏');
    expect(result.consumable.spec.kind).toBe('pill');
    expect((result.consumable.spec as PillSpec).family).toBe('tempering');
    expect((result.consumable.spec as PillSpec).operations).toContainEqual({
      type: 'advance_track',
      track: 'body.organs',
      value: 149,
    });
  });

  it('stores formula target vector and fit metrics in formula alchemy meta', async () => {
    const result = await craftFromFormula(
      'cultivator-1',
      'formula-1',
      ['m1'],
      undefined,
      'analysis-1',
    );

    expect(result.consumable.spec.kind).toBe('pill');
    const alchemyMeta = (result.consumable.spec as PillSpec).alchemyMeta;

    expect(alchemyMeta).toMatchObject({
      source: 'formula',
      propertyVector: [
        { key: 'restore_hp', weight: 0.62 },
        { key: 'heal_wounds', weight: 0.38 },
      ],
      fitBand: 'aligned',
      tags: ['restore_hp', 'heal_wounds', 'healing'],
    });
    if (alchemyMeta.source !== 'formula') {
      throw new Error('expected formula alchemy meta');
    }
    expect(alchemyMeta.fitScore).toBeCloseTo(1, 4);
    expect(alchemyMeta.fitMultiplier).toBeCloseTo(1.15, 4);
  });

  it('adds a warning sentence when fit lands in the degraded middle band', async () => {
    redisGetMock.mockResolvedValueOnce(
      JSON.stringify(
        createAnalysisPayload({
          plan: {
            materialVectors: [
              {
                materialRef: 'material_1',
                materialName: '回春草',
                properties: [
                  { key: 'restore_hp', weight: 0.55 },
                  { key: 'restore_mp', weight: 0.45 },
                ],
              },
            ],
            intentVector: [],
            focusMode: 'balanced',
            requestedElementBias: '木',
          },
          aggregatedPropertyVector: [
            { key: 'restore_hp', weight: 0.55 },
            { key: 'restore_mp', weight: 0.45 },
          ],
          fitScore: 0.55,
          fitBand: 'degraded',
        }),
      ),
    );

    const result = await craftFromFormula(
      'cultivator-1',
      'formula-1',
      ['m1'],
      undefined,
      'analysis-1',
    );

    expect(result.consumable.description).toContain('本炉循方成丹，但药力散逸');
    const alchemyMeta = (result.consumable.spec as PillSpec).alchemyMeta;
    if (alchemyMeta.source !== 'formula') {
      throw new Error('expected formula alchemy meta');
    }
    expect(alchemyMeta.fitScore).toBeCloseTo(0.55, 4);
    expect(alchemyMeta.fitBand).toBe('degraded');
    expect(alchemyMeta.fitMultiplier).toBeCloseTo(0.8786, 4);
  });
});
