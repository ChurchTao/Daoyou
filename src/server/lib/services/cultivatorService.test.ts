import { composeProductFromAffixIds } from '@shared/engine/creation-v2/composeProductFromAffixIds';
import { serializeProductModel } from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findActiveCultivatorRecordByIdMock,
  loadCultivatorRelationsMock,
  normalizeConditionMock,
  tickNaturalRecoveryMock,
} = vi.hoisted(() => ({
  findActiveCultivatorRecordByIdMock: vi.fn(),
  loadCultivatorRelationsMock: vi.fn(),
  normalizeConditionMock: vi.fn((_, condition) => condition),
  tickNaturalRecoveryMock: vi.fn((_, condition) => ({
    ...condition,
    resources: {
      hp: { current: 96 },
      mp: { current: 88 },
    },
    timestamps: {
      ...condition.timestamps,
      lastRecoveryAt: '2026-05-22T00:00:00.000Z',
    },
  })),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(() => ({})),
}));

vi.mock('@server/lib/repositories/cultivatorRepository', () => ({
  existsCultivatorById: vi.fn(),
  findActiveCultivatorIdByUserId: vi.fn(),
  findActiveCultivatorRecordById: findActiveCultivatorRecordByIdMock,
  findActiveCultivatorRecordByIdAndUser: vi.fn(),
  findActiveCultivatorRecordByUserId: vi.fn(),
  findCultivatorOwnerStatusById: vi.fn(),
  hasCultivatorOwnership: vi.fn(),
  hasDeadCultivatorByUserId: vi.fn(),
  loadCultivatorRelations: loadCultivatorRelationsMock,
}));

vi.mock('@server/utils/cultivationUtils', () => ({
  getOrInitCultivationProgress: vi.fn((progress) => progress),
}));

vi.mock('./ConditionService', () => ({
  ConditionService: {
    normalizeCondition: normalizeConditionMock,
    tickNaturalRecovery: tickNaturalRecoveryMock,
  },
}));

vi.mock('./FateEngine', () => ({
  FateEngine: {
    normalizeFates: vi.fn((fates) => fates),
  },
}));

import { getExecutor } from '@server/lib/drizzle/db';
import {
  getCultivatorByIdUnsafe,
  getLastDeadCultivatorSummary,
} from './cultivatorService';

const getExecutorMock = vi.mocked(getExecutor);

function createCondition() {
  return {
    version: 1,
    resources: {
      hp: { current: 120 },
      mp: { current: 120 },
    },
    gauges: {
      pillToxicity: 0,
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
      lastRecoveryAt: '2026-05-21T00:00:00.000Z',
    },
  };
}

function createSelectChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));

  return {
    executor: { select },
    orderBy,
  };
}

function getOrderDirection(orderByArg: unknown): string | undefined {
  const queryChunks = (orderByArg as { queryChunks?: unknown[] })?.queryChunks;
  const lastChunk = queryChunks?.[queryChunks.length - 1] as
    | { value?: string[] }
    | undefined;

  return lastChunk?.value?.[0];
}

function getOrderedColumnName(orderByArg: unknown): string | undefined {
  const queryChunks = (orderByArg as { queryChunks?: unknown[] })?.queryChunks;
  const column = queryChunks?.[1] as { name?: string } | undefined;

  return column?.name;
}

describe('getCultivatorByIdUnsafe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hydrates consumables and materials into inventory relations', async () => {
    findActiveCultivatorRecordByIdMock.mockResolvedValue({
      id: 'cultivator-1',
      userId: 'user-1',
      name: '韩立',
      prompt: '谨慎求道',
      realm: '炼气',
      realm_stage: '圆满',
      age: 28,
      lifespan: 120,
      status: 'active',
      closedDoorYearsTotal: 12,
      vitality: 18,
      spirit: 22,
      wisdom: 24,
      speed: 16,
      willpower: 25,
      max_skills: 4,
      spirit_stones: 320,
      last_yield_at: new Date('2026-05-21T00:00:00.000Z'),
      balance_notes: null,
      cultivation_progress: {
        cultivation_exp: 100,
        exp_cap: 100,
        comprehension_insight: 55,
        bottleneck_state: true,
        breakthrough_failures: 0,
        inner_demon: false,
        deviation_risk: 0,
      },
      condition: createCondition(),
      updatedAt: new Date('2026-05-21T00:00:00.000Z'),
    } as any);

    loadCultivatorRelationsMock.mockResolvedValue({
      spiritualRoots: [],
      preHeavenFates: [],
      creationProducts: [],
      consumables: [
        {
          id: 'pill-1',
          cultivatorId: 'cultivator-1',
          name: '筑基丹',
          type: '丹药',
          prompt: '助我稳住灵气，冲击筑基',
          quality: '真品',
          spec: {
            kind: 'pill',
            family: 'breakthrough',
            operations: [
              {
                type: 'add_status',
                status: 'breakthrough_focus',
                usesRemaining: 1,
              },
              { type: 'change_gauge', gauge: 'pillToxicity', delta: 12 },
            ],
            consumeRules: {
              scene: 'out_of_battle_only',
              quotaCategory: 'long_term',
            },
            alchemyMeta: {
              source: 'improvised',
              sourceMaterials: ['火灵草', '雷纹骨'],
              dominantElement: '火',
              stability: 74,
              toxicityRating: 12,
              tags: ['breakthrough'],
              breakthroughTargetRealm: '筑基',
              breakthroughLabel: '筑基丹',
            },
          },
          quantity: 1,
          description: '药力凝实，可助炼气修士破境。',
          score: 88,
          createdAt: new Date('2026-05-21T00:00:00.000Z'),
          updatedAt: new Date('2026-05-21T00:00:00.000Z'),
        },
      ],
      materials: [
        {
          id: 'mat-1',
          cultivatorId: 'cultivator-1',
          name: '火灵草',
          type: 'herb',
          rank: '真品',
          element: '火',
          description: '火性旺盛，可入破境炉。',
          details: {
            alchemyProfile: {
              effectTags: ['breakthrough'],
              potency: 26,
              toxicity: 3,
              stability: 72,
            },
          },
          quantity: 2,
          createdAt: new Date('2026-05-21T00:00:00.000Z'),
          updatedAt: new Date('2026-05-21T00:00:00.000Z'),
        },
      ],
    });

    const bundle = await getCultivatorByIdUnsafe('cultivator-1');

    expect(bundle?.cultivator.inventory.consumables).toHaveLength(1);
    expect(bundle?.cultivator.inventory.consumables[0]).toMatchObject({
      name: '筑基丹',
      quantity: 1,
      spec: {
        family: 'breakthrough',
        alchemyMeta: {
          breakthroughTargetRealm: '筑基',
        },
      },
    });
    expect(bundle?.cultivator.inventory.materials).toMatchObject([
      {
        name: '火灵草',
        quantity: 2,
        element: '火',
      },
    ]);
    expect(bundle?.cultivator.condition?.resources).toEqual({
      hp: { current: 96 },
      mp: { current: 88 },
    });
    expect(bundle?.cultivator.condition?.timestamps.lastRecoveryAt).toBe(
      '2026-05-22T00:00:00.000Z',
    );
    expect(tickNaturalRecoveryMock).toHaveBeenCalledTimes(1);
  });

  it('gracefully hydrates legacy skill products without stored battleProjection', async () => {
    const legacySkillProduct = serializeProductModel(
      composeProductFromAffixIds({
        productType: 'skill',
        element: '火',
        name: '残卷火符',
        affixIds: ['skill-core-damage-fire'],
      }),
    ) as Record<string, unknown>;
    delete legacySkillProduct.projectionBasisEnergy;

    findActiveCultivatorRecordByIdMock.mockResolvedValue({
      id: 'cultivator-1',
      userId: 'user-1',
      name: '韩立',
      prompt: '谨慎求道',
      realm: '炼气',
      realm_stage: '圆满',
      age: 28,
      lifespan: 120,
      status: 'active',
      closedDoorYearsTotal: 12,
      vitality: 18,
      spirit: 22,
      wisdom: 24,
      speed: 16,
      willpower: 25,
      max_skills: 4,
      spirit_stones: 320,
      last_yield_at: new Date('2026-05-21T00:00:00.000Z'),
      balance_notes: null,
      cultivation_progress: {
        cultivation_exp: 100,
        exp_cap: 100,
        comprehension_insight: 55,
        bottleneck_state: true,
        breakthrough_failures: 0,
        inner_demon: false,
        deviation_risk: 0,
      },
      condition: createCondition(),
      updatedAt: new Date('2026-05-21T00:00:00.000Z'),
    } as any);

    loadCultivatorRelationsMock.mockResolvedValue({
      spiritualRoots: [],
      preHeavenFates: [],
      creationProducts: [
        {
          id: 'skill-1',
          productType: 'skill',
          name: '残卷火符',
          description: '旧档导入的技能产物',
          element: '火',
          quality: '凡品',
          slot: null,
          score: 18,
          isEquipped: false,
          productModel: legacySkillProduct,
        },
      ],
      consumables: [],
      materials: [],
    });

    const bundle = await getCultivatorByIdUnsafe('cultivator-1');

    expect(bundle?.cultivator.skills).toHaveLength(1);
    expect(bundle?.cultivator.skills[0]).toMatchObject({
      id: 'skill-1',
      name: '残卷火符',
      cost: 80,
      cooldown: 2,
    });
  });
});

describe('getLastDeadCultivatorSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the latest dead cultivator and its latest terminal story in descending order', async () => {
    const deadCultivatorQuery = createSelectChain([
      {
        id: 'cultivator-latest',
        name: '韩立',
        realm: '筑基',
        realm_stage: '后期',
      },
    ]);
    const historyQuery = createSelectChain([
      {
        story: '炉火将熄，余念仍指向大道。',
      },
    ]);

    getExecutorMock
      .mockReturnValueOnce(deadCultivatorQuery.executor as any)
      .mockReturnValueOnce(historyQuery.executor as any);

    const summary = await getLastDeadCultivatorSummary('user-1');

    expect(summary).toEqual({
      id: 'cultivator-latest',
      name: '韩立',
      realm: '筑基',
      realm_stage: '后期',
      story: '炉火将熄，余念仍指向大道。',
    });
    expect(
      getOrderedColumnName(deadCultivatorQuery.orderBy.mock.calls[0]?.[0]),
    ).toBe('updated_at');
    expect(
      getOrderDirection(deadCultivatorQuery.orderBy.mock.calls[0]?.[0]),
    ).toBe(' desc');
    expect(getOrderedColumnName(historyQuery.orderBy.mock.calls[0]?.[0])).toBe(
      'created_at',
    );
    expect(getOrderDirection(historyQuery.orderBy.mock.calls[0]?.[0])).toBe(
      ' desc',
    );
  });
});
