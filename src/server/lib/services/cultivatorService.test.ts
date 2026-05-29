const {
  dbExecutorMock,
  getExecutorMock,
  hasCultivatorOwnershipMock,
  insertMock,
} = vi.hoisted(() => ({
  dbExecutorMock: { tag: 'db-executor' },
  getExecutorMock: vi.fn(),
  hasCultivatorOwnershipMock: vi.fn(),
  insertMock: vi.fn(),
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
import { rehydrateStoredProductModel } from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import { buildPresetArtifact } from '@shared/engine/cultivator/creation/presetProducts';
import { addArtifactToInventory } from './cultivatorService';

describe('addArtifactToInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getExecutorMock.mockReturnValue(dbExecutorMock);
    hasCultivatorOwnershipMock.mockResolvedValue(true);
    insertMock.mockResolvedValue({
      id: 'product-1',
    });
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
