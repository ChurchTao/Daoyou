const {
  dbExecutorMock,
  getExecutorMock,
  hasCultivatorOwnershipMock,
  insertMock,
  loadCultivatorRelationsMock,
  setMock,
  updateMock,
  whereMock,
} = vi.hoisted(() => ({
  dbExecutorMock: {} as Record<string, unknown>,
  getExecutorMock: vi.fn(),
  hasCultivatorOwnershipMock: vi.fn(),
  insertMock: vi.fn(),
  loadCultivatorRelationsMock: vi.fn(),
  setMock: vi.fn(),
  updateMock: vi.fn(),
  whereMock: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

vi.mock('@server/lib/repositories/cultivatorRepository', async () => {
  const actual =
    await vi.importActual<typeof import('@server/lib/repositories/cultivatorRepository')>(
      '@server/lib/repositories/cultivatorRepository',
    );

  return {
    ...actual,
    hasCultivatorOwnership: hasCultivatorOwnershipMock,
    loadCultivatorRelations: loadCultivatorRelationsMock,
  };
});

vi.mock('@server/lib/repositories/creationProductRepository', async () => {
  const actual =
    await vi.importActual<typeof import('@server/lib/repositories/creationProductRepository')>(
      '@server/lib/repositories/creationProductRepository',
    );

  return {
    ...actual,
    insert: insertMock,
  };
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@server/lib/drizzle/schema';
import { rehydrateStoredProductModel } from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import { BASIC_SKILLS, BASIC_TECHNIQUES } from '@shared/engine/cultivator/creation/config';
import { buildPresetArtifact } from '@shared/engine/cultivator/creation/presetProducts';
import type { Cultivator } from '@shared/types/cultivator';
import {
  addArtifactToInventory,
  createCultivator,
  updateCultivatorGameSettings,
} from './cultivatorService';

function createGeneratedCultivator(): Cultivator {
  return {
    id: '',
    name: '初入山门',
    gender: '男',
    origin: '青石镇',
    personality: '沉稳',
    background: '初入道途',
    prompt: '测试角色',
    realm: '炼气',
    realm_stage: '初期',
    age: 16,
    lifespan: 100,
    status: 'active',
    attributes: {
      vitality: 12,
      spirit: 14,
      wisdom: 13,
      speed: 11,
      willpower: 10,
    },
    spiritual_roots: [{ element: '金', strength: 90, grade: '天灵根' }],
    pre_heaven_fates: [],
    cultivations: [BASIC_TECHNIQUES.金()],
    skills: [...BASIC_SKILLS.金],
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
    spirit_stones: 0,
  };
}

describe('createCultivator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists starter gongfa and skills as equipped so the new cultivator can fight immediately', async () => {
    const cultivator = createGeneratedCultivator();
    let createdProductRows: Record<string, unknown>[] = [];
    const persistedRecord = {
      id: 'cultivator-1',
      userId: 'user-1',
      name: cultivator.name,
      title: null,
      gender: cultivator.gender,
      origin: cultivator.origin,
      personality: cultivator.personality,
      background: cultivator.background,
      prompt: cultivator.prompt,
      realm: cultivator.realm,
      realm_stage: cultivator.realm_stage,
      age: cultivator.age,
      lifespan: cultivator.lifespan,
      closedDoorYearsTotal: 0,
      status: 'active',
      diedAt: null,
      vitality: cultivator.attributes.vitality,
      spirit: cultivator.attributes.spirit,
      wisdom: cultivator.attributes.wisdom,
      speed: cultivator.attributes.speed,
      willpower: cultivator.attributes.willpower,
      spirit_stones: 0,
      reputation: 0,
      qi: 200,
      qiLastRefreshedAt: new Date('2026-01-01T00:00:00.000Z'),
      last_yield_at: new Date('2026-01-01T00:00:00.000Z'),
      max_skills: cultivator.max_skills,
      balance_notes: null,
      condition: {},
      gameSettings: {},
      cultivation_progress: {},
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    } as typeof schema.cultivators.$inferSelect;

    const tx = {
      insert: vi.fn((table: unknown) => ({
        values: vi.fn((values: unknown) => {
          if (table === schema.cultivators) {
            return {
              returning: vi.fn().mockResolvedValue([persistedRecord]),
            };
          }

          if (table === schema.creationProducts) {
            createdProductRows = Array.isArray(values)
              ? (values as Record<string, unknown>[])
              : [values as Record<string, unknown>];
          }

          return Promise.resolve(undefined);
        }),
      })),
    };
    const executor = {
      transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(tx),
      ),
    };

    getExecutorMock.mockReturnValue(executor);
    loadCultivatorRelationsMock.mockImplementation(async () => ({
      spiritualRoots: [
        {
          cultivatorId: 'cultivator-1',
          element: '金',
          strength: 90,
          grade: '天灵根',
        },
      ],
      preHeavenFates: [],
      creationProducts: createdProductRows.map((row, index) => ({
        id: `product-${index + 1}`,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...row,
      })),
      consumables: [],
      materials: [],
    }));

    const result = await createCultivator('user-1', cultivator);
    const starterRows = createdProductRows.filter(
      (row) => row.productType === 'gongfa' || row.productType === 'skill',
    );

    expect(starterRows).toHaveLength(
      cultivator.cultivations.length + cultivator.skills.length,
    );
    expect(starterRows.every((row) => row.isEquipped === true)).toBe(true);
    expect(result.cultivations).toHaveLength(cultivator.cultivations.length);
    expect(result.skills).toHaveLength(cultivator.skills.length);
  });
});

describe('addArtifactToInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbExecutorMock.update = updateMock;
    getExecutorMock.mockReturnValue(dbExecutorMock);
    hasCultivatorOwnershipMock.mockResolvedValue(true);
    insertMock.mockResolvedValue({
      id: 'product-1',
    });
    updateMock.mockReturnValue({ set: setMock });
    setMock.mockReturnValue({ where: whereMock });
    whereMock.mockResolvedValue(undefined);
  });

  it('persists the incoming artifact productModel instead of replacing it with an empty shell', async () => {
    const artifact = buildPresetArtifact({
      id: 'artifact-1',
      name: '离火古印',
      slot: 'accessory',
      element: '火',
      affixIds: [
        'artifact-panel-weapon-dual-atk',
        'artifact-panel-atk',
      ],
      realm: '金丹',
      realmStage: '中期',
      creatorName: '测试造物者',
      creatorCultivatorId: 'creator-1',
      isEquipped: false,
    });

    await addArtifactToInventory('user-1', 'cultivator-1', artifact);

    expect(insertMock).toHaveBeenCalledTimes(1);
    const [row, executor] = insertMock.mock.calls[0] as [
      Record<string, unknown>,
      unknown,
    ];

    expect(executor).toBe(dbExecutorMock);
    expect(row).toMatchObject({
      cultivatorId: 'cultivator-1',
      productType: 'artifact',
      name: '离火古印',
      slot: 'accessory',
      isEquipped: false,
    });

    const storedProductModel = row.productModel as Record<string, unknown>;
    expect(storedProductModel.productType).toBe('artifact');
    expect(Array.isArray(storedProductModel.affixes)).toBe(true);
    expect((storedProductModel.affixes as unknown[]).length).toBeGreaterThan(0);
    expect(storedProductModel).not.toEqual({ affixes: [] });
    expect(
      rehydrateStoredProductModel(storedProductModel, artifact.element),
    ).toBeDefined();
  });

  it('rejects artifact rewards with a missing productModel before writing bad data', async () => {
    const artifact = {
      ...buildPresetArtifact({
        id: 'artifact-2',
        name: '寒魄环',
        slot: 'armor',
        element: '水',
        affixIds: [
          'artifact-panel-atk',
          'artifact-defense-mana-recovery',
        ],
        realm: '筑基',
        realmStage: '后期',
        creatorName: '测试造物者',
        creatorCultivatorId: 'creator-2',
        isEquipped: false,
      }),
      productModel: undefined,
    };

    await expect(
      addArtifactToInventory('user-1', 'cultivator-1', artifact),
    ).rejects.toThrow('法宝数据缺少有效 productModel，无法入库');
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe('updateCultivatorGameSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbExecutorMock.update = updateMock;
    getExecutorMock.mockReturnValue(dbExecutorMock);
    updateMock.mockReturnValue({ set: setMock });
    setMock.mockReturnValue({ where: whereMock });
    whereMock.mockResolvedValue(undefined);
  });

  it('normalizes and persists cultivator game settings', async () => {
    const result = await updateCultivatorGameSettings('cultivator-1', {
      battleAbilityStrategy: {
        version: 1,
        mode: 'conservative',
        healHpSkipThreshold: 0.4,
        emergencyHealHpThreshold: 0.8,
        restoreMpSkipThreshold: 0.6,
        avoidRepeatControl: true,
      },
    });

    expect(result.battleAbilityStrategy).toMatchObject({
      mode: 'conservative',
      healHpSkipThreshold: 0.4,
      emergencyHealHpThreshold: 0.4,
      restoreMpSkipThreshold: 0.6,
      avoidRepeatControl: true,
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(setMock).toHaveBeenCalledWith({
      gameSettings: result,
    });
    expect(whereMock).toHaveBeenCalledTimes(1);
  });
});
