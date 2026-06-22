const {
  executorState,
  getExecutorMock,
  redisDelMock,
  redisGetMock,
  redisSetMock,
} = vi.hoisted(() => {
  const state = {
    selectRows: [] as any[],
    txExistingRows: [] as any[],
    deletedRows: [] as any[],
    insertedRow: null as any,
    insertedValues: null as any,
  };

  const tx = {
    select() {
      return {
        from() {
          return {
            where: async () => state.txExistingRows,
          };
        },
      };
    },
    insert() {
      return {
        values(values: any) {
          state.insertedValues = values;
          return {
            returning: async () => [
              state.insertedRow ?? {
                id: '22222222-2222-2222-2222-222222222222',
                ...values,
                createdAt: new Date('2026-05-15T00:00:00.000Z'),
                updatedAt: new Date('2026-05-15T00:00:00.000Z'),
              },
            ],
          };
        },
      };
    },
  };

  const executor = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                orderBy: async () => state.selectRows,
                limit: async () => state.selectRows,
              };
            },
          };
        },
      };
    },
    delete() {
      return {
        where() {
          return {
            returning: async () => state.deletedRows,
          };
        },
      };
    },
    transaction: async (callback: (tx: any) => Promise<void>) => callback(tx),
  };

  return {
    executorState: state,
    getExecutorMock: vi.fn(() => executor),
    redisSetMock: vi.fn(),
    redisGetMock: vi.fn(),
    redisDelMock: vi.fn(),
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
  },
}));

vi.mock('./cultivatorService', () => ({
  addConsumableToInventory: vi.fn(),
}));

import type {
  AlchemyFormula,
  CompatibleWeightedAlchemyProperty,
  PillSpec,
  WeightedAlchemyProperty,
} from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';
import {
  advanceFormulaMastery,
  buildDiscoveryCandidate,
  buildFormulaSignature,
  calculateFormulaFitMultiplier,
  confirmDiscoveryCandidate,
  deleteCultivatorFormula,
  listCultivatorFormulas,
} from './AlchemyFormulaService';

function createVector(
  entries: Array<[WeightedAlchemyProperty['key'], number]>,
): WeightedAlchemyProperty[] {
  return entries.map(([key, weight]) => ({ key, weight }));
}

function createLegacyVector(
  entries: Array<[CompatibleWeightedAlchemyProperty['key'], number]>,
): WeightedAlchemyProperty[] {
  return entries.map(([key, weight]) => ({ key, weight })) as WeightedAlchemyProperty[];
}

function createFormula(
  overrides: Partial<AlchemyFormula> = {},
): AlchemyFormula {
  return {
    id: overrides.id ?? '11111111-1111-1111-1111-111111111111',
    cultivatorId: overrides.cultivatorId ?? 'cultivator-1',
    name: overrides.name ?? '青木疗伤丹丹方',
    description:
      overrides.description ?? '此方偏于生机温养，主走木性回春之路。',
    family: overrides.family ?? 'healing',
    pattern: overrides.pattern ?? {
      targetPropertyVector: createVector([
        ['restore_hp', 0.64],
        ['heal_wounds', 0.36],
      ]),
      dominantElement: '木',
      minQuality: '真品',
      slotCount: 2,
    },
    blueprint: overrides.blueprint ?? {
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
      targetStability: 72,
      targetToxicity: 6,
    },
    mastery: overrides.mastery ?? {
      level: 0,
      exp: 0,
    },
    createdAt: overrides.createdAt ?? '2026-05-15T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-15T00:00:00.000Z',
  };
}

function createConsumable(): Consumable & { spec: PillSpec } {
  return {
    id: 'pill-1',
    name: '青木回春丹',
    type: '丹药',
    quality: '真品',
    quantity: 1,
    description: '炉中木气归拢，药势温和。',
    prompt: '恢复伤势',
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
        { type: 'remove_status', status: 'minor_wound' },
        { type: 'change_gauge', gauge: 'pillToxicity', delta: 4 },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['青岚草', '回春露'],
        analysisVersion: 2,
        propertyVector: createVector([
          ['restore_hp', 0.64],
          ['heal_wounds', 0.36],
        ]),
        sourceMaterialVectors: [
          {
            materialRef: 'material_1',
            materialName: '青岚草',
            properties: [{ key: 'restore_hp', weight: 1 }],
          },
        ],
        dominantElement: '木',
        stability: 78,
        toxicityRating: 6,
        tags: ['restore_hp', 'heal_wounds', 'healing'],
      },
    },
  };
}

describe('AlchemyFormulaService', () => {
  beforeEach(() => {
    executorState.selectRows = [];
    executorState.txExistingRows = [];
    executorState.deletedRows = [];
    executorState.insertedRow = null;
    executorState.insertedValues = null;
    redisSetMock.mockReset();
    redisGetMock.mockReset();
    redisDelMock.mockReset();
  });

  it('normalizes formula signatures independent of property vector order', () => {
    const left = createFormula({
      pattern: {
        targetPropertyVector: createVector([
          ['heal_wounds', 0.36],
          ['restore_hp', 0.64],
        ]),
        slotCount: 2,
      },
    });
    const right = createFormula({
      pattern: {
        targetPropertyVector: createVector([
          ['restore_hp', 0.64],
          ['heal_wounds', 0.36],
        ]),
        slotCount: 2,
      },
    });

    expect(buildFormulaSignature(left)).toBe(buildFormulaSignature(right));
  });

  it('normalizes legacy tempering formula signatures into body properties', () => {
    const legacy = createFormula({
      family: 'tempering',
      pattern: {
        targetPropertyVector: createLegacyVector([['tempering_spirit', 1]]),
        slotCount: 1,
      },
      blueprint: {
        operations: [
          {
            type: 'advance_track',
            track: 'body.organs',
            value: 40,
          },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'long_term',
        },
        targetStability: 70,
        targetToxicity: 10,
      },
    });
    const current = createFormula({
      family: 'tempering',
      pattern: {
        targetPropertyVector: createVector([['body_organs', 1]]),
        slotCount: 1,
      },
      blueprint: legacy.blueprint,
    });

    expect(buildFormulaSignature(legacy)).toBe(buildFormulaSignature(current));
  });

  it('canonicalizes legacy tempering properties when listing formulas', async () => {
    executorState.selectRows = [
      {
        ...createFormula({
          family: 'tempering',
          pattern: {
            targetPropertyVector: createLegacyVector([['tempering_spirit', 1]]),
            slotCount: 1,
          },
        }),
        createdAt: new Date('2026-05-15T00:00:00.000Z'),
        updatedAt: new Date('2026-05-15T00:00:00.000Z'),
      },
    ];

    const formulas = await listCultivatorFormulas('cultivator-1');

    expect(formulas[0]?.pattern.targetPropertyVector).toEqual([
      { key: 'body_organs', weight: 1 },
    ]);
  });

  it('calculates fit multiplier from overlap, dominant element and surplus quality', () => {
    const formula = createFormula();
    const multiplier = calculateFormulaFitMultiplier(
      formula,
      createVector([
        ['restore_hp', 0.64],
        ['heal_wounds', 0.36],
      ]),
      '木',
      [
        {
          id: 'm1',
          materialRef: 'material_1',
          name: '青岚草',
          description: '可补充气血。',
          rank: '天品',
          element: '木',
          type: 'herb',
          dose: 1,
        },
        {
          id: 'm2',
          materialRef: 'material_2',
          name: '回春露',
          description: '可治愈伤口。',
          rank: '真品',
          element: '木',
          type: 'aux',
          dose: 1,
        },
      ],
    );

    expect(multiplier).toBeCloseTo(1.15);
  });

  it('advances mastery with overflow exp', () => {
    expect(
      advanceFormulaMastery({
        level: 0,
        exp: 4,
      }),
    ).toEqual({
      next: {
        level: 1,
        exp: 0,
      },
      progress: {
        previousLevel: 0,
        level: 1,
        exp: 0,
        gainedExp: 1,
        leveledUp: true,
      },
    });
  });

  it('builds a discovery candidate and stores the target property vector', async () => {
    redisSetMock.mockResolvedValueOnce('OK');

    const candidate = await buildDiscoveryCandidate('cultivator-1', {
      consumable: createConsumable(),
      materials: [
        {
          id: 'm1',
          materialRef: 'material_1',
          name: '青岚草',
          description: '可补充气血。',
          rank: '真品',
          element: '木',
          type: 'herb',
          dose: 1,
        },
        {
          id: 'm2',
          materialRef: 'material_2',
          name: '回春露',
          description: '可治愈伤口。',
          rank: '真品',
          element: '木',
          type: 'aux',
          dose: 1,
        },
      ],
    });

    expect(candidate).toEqual({
      token: expect.any(String),
      name: '青木回春丹丹方',
      description: expect.stringContaining(
        '药性取向为补充气血 64%、治愈伤势 36%',
      ),
      family: 'healing',
      discoveryRemark: expect.stringContaining('《青木回春丹丹方》'),
      patternSummary: expect.stringContaining(
        '目标药性：补充气血 64%、治愈伤势 36%',
      ),
    });
    expect(redisSetMock).toHaveBeenCalledTimes(1);
  });

  it('persists discovered formula on accept', async () => {
    const formula = createFormula();
    const payload = {
      cultivatorId: 'cultivator-1',
      formula: {
        cultivatorId: formula.cultivatorId,
        name: formula.name,
        description: formula.description,
        family: formula.family,
        pattern: formula.pattern,
        blueprint: formula.blueprint,
        mastery: formula.mastery,
      },
      signature: buildFormulaSignature(formula),
    };
    redisGetMock.mockResolvedValueOnce(JSON.stringify(payload));
    redisDelMock.mockResolvedValueOnce(1);
    executorState.txExistingRows = [];

    const result = await confirmDiscoveryCandidate(
      'cultivator-1',
      '11111111-1111-4111-8111-111111111111',
      true,
    );

    expect(result).toEqual({
      saved: true,
      formula: expect.objectContaining({
        name: '青木疗伤丹丹方',
      }),
    });
    expect(executorState.insertedValues.pattern.targetPropertyVector).toEqual(
      createVector([
        ['restore_hp', 0.64],
        ['heal_wounds', 0.36],
      ]),
    );
  });

  it('fails loudly when legacy formulas remain in storage', async () => {
    executorState.selectRows = [
      {
        id: 'legacy-formula',
        cultivatorId: 'cultivator-1',
        name: '旧丹方',
        description: '旧结构',
        family: 'healing',
        pattern: {
          requiredTags: ['healing'],
          slotCount: 1,
        },
        blueprint: createFormula().blueprint,
        mastery: { level: 0, exp: 0 },
        createdAt: new Date('2026-05-15T00:00:00.000Z'),
        updatedAt: new Date('2026-05-15T00:00:00.000Z'),
      },
    ];

    await expect(listCultivatorFormulas('cultivator-1')).rejects.toThrow(
      '丹方数据已损坏，请删除后重新悟方。',
    );
  });

  it('deletes an owned formula', async () => {
    executorState.deletedRows = [
      {
        id: '11111111-1111-4111-8111-111111111111',
      },
    ];

    await expect(
      deleteCultivatorFormula(
        'cultivator-1',
        '11111111-1111-4111-8111-111111111111',
      ),
    ).resolves.toBeUndefined();
  });
});
