import { jest } from '@jest/globals';

const mockCraftAsync: jest.Mock = jest.fn();
const mockDeserializeCraftedOutcomeSnapshot: jest.Mock = jest.fn();
const mockRestoreCraftedOutcome: jest.Mock = jest.fn();
const mockSerializeCraftedOutcomeSnapshot: jest.Mock = jest.fn();
const mockSnapshotCraftedOutcome: jest.Mock = jest.fn();
const mockToRow: jest.Mock = jest.fn();
const mockRedisSet: jest.Mock = jest.fn();
const mockRedisGet: jest.Mock = jest.fn();
const mockRedisDel: jest.Mock = jest.fn();
const mockCountByType: jest.Mock = jest.fn();
const mockInsert: jest.Mock = jest.fn();
const mockFindById: jest.Mock = jest.fn();
const mockDeleteById: jest.Mock = jest.fn();
const mockGetCultivatorByIdUnsafe: jest.Mock = jest.fn();
const mockEvaluateCreationContext: jest.Mock = jest.fn();
const mockGetCreationProductTypeFromCraftType: jest.Mock = jest.fn();
const mockCalculateMaxQuality: jest.Mock = jest.fn();
const mockCalculateCraftCost: jest.Mock = jest.fn();

jest.mock('@/engine/creation-v2/CreationOrchestrator', () => ({
  CreationOrchestrator: jest.fn().mockImplementation(() => ({
    craftAsync: mockCraftAsync,
  })),
}));

jest.mock('@/engine/creation-v2/analysis/DefaultMaterialAnalyzer', () => ({
  DefaultMaterialAnalyzer: jest.fn().mockImplementation(() => ({
    analyze: jest.fn(),
  })),
}));

jest.mock('@/engine/creation-v2/analysis/MaterialFactsBuilder', () => ({
  MaterialFactsBuilder: jest.fn().mockImplementation(() => ({
    build: jest.fn(),
  })),
}));

jest.mock('@/engine/creation-v2/adapters/CreationAbilityAdapter', () => ({
  CreationAbilityAdapter: jest.fn(),
}));

jest.mock('@/engine/creation-v2/config/CreationCraftPolicy', () => ({
  getCreationProductTypeFromCraftType: mockGetCreationProductTypeFromCraftType,
}));

jest.mock('@/engine/creation-v2/config/CreationBalance', () => ({
  CREATION_INPUT_CONSTRAINTS: {
    minQuantityPerMaterial: 1,
    maxQuantityPerMaterial: 3,
  },
}));

jest.mock('@/engine/creation-v2/persistence/OutcomeSnapshot', () => ({
  deserializeCraftedOutcomeSnapshot: mockDeserializeCraftedOutcomeSnapshot,
  restoreCraftedOutcome: mockRestoreCraftedOutcome,
  serializeCraftedOutcomeSnapshot: mockSerializeCraftedOutcomeSnapshot,
  snapshotCraftedOutcome: mockSnapshotCraftedOutcome,
}));

jest.mock('@/engine/creation-v2/persistence/ProductPersistenceMapper', () => ({
  toRow: mockToRow,
}));

jest.mock('@/engine/creation-v2/rules/material/MaterialRuleSet', () => ({
  MaterialRuleSet: jest.fn().mockImplementation(() => ({
    evaluate: jest.fn(),
  })),
}));

jest.mock('@/engine/creation-v2/rules/recipe/ProductSupportRules', () => ({
  supportsProductType: jest.fn(),
}));

jest.mock('@/engine/creation-v2/CraftCostCalculator', () => ({
  calculateCraftCost: mockCalculateCraftCost,
  calculateMaxQuality: mockCalculateMaxQuality,
}));

jest.mock('@/lib/drizzle/db', () => ({
  getExecutor: jest.fn(),
}));

jest.mock('@/lib/redis', () => ({
  redis: {
    set: mockRedisSet,
    get: mockRedisGet,
    del: mockRedisDel,
  },
}));

jest.mock('@/lib/repositories/creationProductRepository', () => ({
  countByType: mockCountByType,
  insert: mockInsert,
  findById: mockFindById,
  deleteById: mockDeleteById,
}));

jest.mock('./cultivatorService', () => ({
  getCultivatorByIdUnsafe: mockGetCultivatorByIdUnsafe,
}));

jest.mock('./FateEngine', () => ({
  FateEngine: {
    evaluateCreationContext: mockEvaluateCreationContext,
  },
}));

import { describe, expect, it, beforeEach } from '@jest/globals';

const { getExecutor } = jest.requireMock('@/lib/drizzle/db') as {
  getExecutor: jest.Mock;
};
const { getPendingCreation, processCreation } = jest.requireActual(
  './creationServiceV2',
) as typeof import('./creationServiceV2');

function createMaterialSelectChain(rows: unknown[]) {
  const chain = {
    from: jest.fn(),
    where: jest.fn(),
  };

  chain.from.mockReturnValue(chain);
  chain.where.mockImplementation(async () => rows);

  return chain;
}

function createCultivatorSelectChain(rows: unknown[]) {
  const chain = {
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
  };

  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.limit.mockImplementation(async () => rows);

  return chain;
}

function createTransactionExecutor() {
  const chain = {
    update: jest.fn(),
    delete: jest.fn(),
  };
  const updateWhere = jest.fn(async () => undefined);
  const deleteWhere = jest.fn(async () => undefined);

  chain.update.mockImplementation(() => ({
    set: jest.fn(() => ({
      where: updateWhere,
    })),
  }));
  chain.delete.mockImplementation(() => ({
    where: deleteWhere,
  }));

  return chain;
}

describe('creationServiceV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetCreationProductTypeFromCraftType.mockImplementation(
      ((craftType: string) => {
        if (craftType === 'refine') return 'artifact';
        if (craftType === 'create_skill') return 'skill';
        if (craftType === 'create_gongfa') return 'gongfa';
        return undefined;
      }) as never,
    );
    mockCalculateMaxQuality.mockReturnValue('玄品');
    mockCalculateCraftCost.mockReturnValue(20);
    mockRedisSet.mockResolvedValue('OK' as never);
    mockRedisDel.mockResolvedValue(undefined as never);
    mockEvaluateCreationContext.mockReturnValue({
      summary: '',
      positiveTagBiases: [],
      negativeTagBiases: [],
    });
    mockGetCultivatorByIdUnsafe.mockResolvedValue(
      {
        cultivator: { pre_heaven_fates: [] },
      } as never,
    );
    mockSerializeCraftedOutcomeSnapshot.mockReturnValue('serialized-snapshot');
    mockSnapshotCraftedOutcome.mockReturnValue({ id: 'snapshot-1' });
  });

  it('直接造物成功时应返回可直接渲染详情弹窗的 productModel', async () => {
    const selectedMaterials = [
      {
        id: 'mat-1',
        cultivatorId: 'cultivator-1',
        name: '玄雷矿',
        type: 'ore',
        rank: '玄品',
        element: '雷',
        description: '矿中藏雷',
        details: null,
        quantity: 2,
      },
    ];
    const cultivatorRows = [
      {
        id: 'cultivator-1',
        name: '玄真子',
        realm: '筑基',
        realm_stage: '前期',
        spirit_stones: 200,
        cultivation_progress: null,
        max_skills: 3,
      },
    ];
    const row = {
      cultivatorId: 'cultivator-1',
      productType: 'artifact',
      name: '惊霆锤',
      description: '锤身藏雷，击时有霆鸣。',
      element: '雷',
      quality: '玄品',
      slot: 'weapon',
      score: 88,
      isEquipped: false,
      abilityConfig: {},
      productModel: {
        productType: 'artifact',
        affixes: [
          {
            id: 'artifact-thunder',
            name: '雷鸣',
            category: 'attack',
            isPerfect: false,
            rollEfficiency: 0.76,
          },
        ],
      },
    };
    const outcome = {
      blueprint: {
        productModel: {
          affixes: [
            {
              id: 'artifact-thunder',
              name: '雷鸣',
              category: 'attack',
              isPerfect: false,
              rollEfficiency: 0.76,
            },
          ],
        },
      },
      ability: {},
    };

    mockCraftAsync.mockResolvedValue({ state: { outcome } } as never);
    mockToRow.mockReturnValue(row);
    mockInsert.mockResolvedValue({ id: 'artifact-1' } as never);

    const materialChain = createMaterialSelectChain(selectedMaterials);
    const cultivatorChain = createCultivatorSelectChain(cultivatorRows);
    const tx = createTransactionExecutor();
    const mockExecutor = {
      select: jest
        .fn()
        .mockImplementationOnce(() => materialChain)
        .mockImplementationOnce(() => cultivatorChain),
      transaction: jest.fn(async (callback: (executor: unknown) => Promise<void>) => {
        await callback(tx);
      }),
    };
    (getExecutor as jest.Mock).mockReturnValue(mockExecutor);

    const result = await processCreation(
      'cultivator-1',
      ['mat-1'],
      'refine',
      { requestedSlot: 'weapon' },
    );

    expect(result).toMatchObject({
      id: 'artifact-1',
      name: '惊霆锤',
      productType: 'artifact',
      productModel: row.productModel,
    });
    expect(result.affixes[0]).toMatchObject({
      id: 'artifact-thunder',
      name: '雷鸣',
    });
  });

  it('待替换产物应可从 snapshot 还原出完整预览结构', async () => {
    const row = {
      cultivatorId: 'cultivator-1',
      productType: 'skill',
      name: '赤霄焚风',
      description: '借风驭火，焚空成痕。',
      element: '火',
      quality: '地品',
      slot: null,
      score: 103,
      isEquipped: false,
      abilityConfig: {},
      productModel: {
        productType: 'skill',
        affixes: [
          {
            id: 'skill-fire',
            name: '焚风',
            category: 'attack',
            isPerfect: true,
            rollEfficiency: 1,
          },
        ],
      },
    };
    const outcome = {
      blueprint: {
        productModel: {
          affixes: [
            {
              id: 'skill-fire',
              name: '焚风',
              category: 'attack',
              isPerfect: true,
              rollEfficiency: 1,
            },
          ],
        },
      },
      ability: {},
    };

    mockRedisGet.mockResolvedValue(
      JSON.stringify({
        snapshot: 'stored-snapshot',
        previewName: '旧字段兼容',
      }) as never,
    );
    mockDeserializeCraftedOutcomeSnapshot.mockReturnValue({ id: 'snapshot-1' });
    mockRestoreCraftedOutcome.mockReturnValue(outcome);
    mockToRow.mockReturnValue(row);

    const pending = await getPendingCreation('cultivator-1', 'create_skill');

    expect(pending).toMatchObject({
      snapshot: 'stored-snapshot',
      name: '赤霄焚风',
      productType: 'skill',
      quality: '地品',
      element: '火',
      score: 103,
      productModel: row.productModel,
    });
  });
});
