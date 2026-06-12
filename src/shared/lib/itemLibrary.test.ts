import { buildPresetArtifact } from '@shared/engine/cultivator/creation/presetProducts';
import { serializeProductModel } from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import {
  ItemLibraryResolveError,
  attachmentsToResourceOperations,
  buildAttachmentFromItemLibraryEntry,
  parseItemLibraryEntry,
  resolveItemLibrarySelections,
} from './itemLibrary';

describe('item library helpers', () => {
  const baseMeta = {
    id: '11111111-1111-4111-8111-111111111111',
    itemId: 'refined_iron',
    status: 'published' as const,
    name: '精炼玄铁',
    description: null,
    quality: '玄品',
    element: '金',
    category: 'ore',
    editorConfig: {},
    createdBy: '11111111-1111-4111-8111-111111111111',
    updatedBy: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };

  it('parses material and resolves selections into mail attachments', () => {
    const item = parseItemLibraryEntry({
      ...baseMeta,
      type: 'material',
      payload: {
        name: '精炼玄铁',
        type: 'ore',
        rank: '玄品',
        element: '金',
      },
    });

    expect(
      resolveItemLibrarySelections(
        [
          { type: 'spirit_stones', quantity: 1200 },
          { type: 'item_library', itemId: 'refined_iron', quantity: 3 },
        ],
        [item],
      ),
    ).toEqual([
      {
        type: 'spirit_stones',
        name: '灵石',
        quantity: 1200,
      },
      {
        type: 'material',
        name: '精炼玄铁',
        quantity: 3,
        data: {
          name: '精炼玄铁',
          type: 'ore',
          rank: '玄品',
          element: '金',
          quantity: 3,
        },
      },
    ]);
  });

  it('rejects archived entries during attachment build', () => {
    const item = parseItemLibraryEntry({
      ...baseMeta,
      status: 'archived',
      type: 'material',
      payload: {
        name: '精炼玄铁',
        type: 'ore',
        rank: '玄品',
      },
    });

    expect(() => buildAttachmentFromItemLibraryEntry(item, 1)).toThrow(
      ItemLibraryResolveError,
    );
  });

  it('converts reputation attachments into resource operations', () => {
    expect(
      attachmentsToResourceOperations([
        { type: 'reputation', name: '声望', quantity: 20 },
      ]),
    ).toEqual([{ type: 'reputation', value: 20 }]);
  });

  it('accepts creation-v2 artifact payloads with rehydratable productModel', () => {
    const artifact = buildPresetArtifact({
      name: '离火古印',
      slot: 'accessory',
      element: '火',
      affixIds: ['artifact-panel-atk'],
      realm: '筑基',
      realmStage: '后期',
    });

    const item = parseItemLibraryEntry({
      ...baseMeta,
      id: '22222222-2222-4222-8222-222222222222',
      itemId: 'lihuo_seal',
      type: 'artifact',
      name: '离火古印',
      category: 'accessory',
      element: '火',
      quality: artifact.quality,
      payload: {
        name: artifact.name,
        slot: artifact.slot,
        element: artifact.element,
        quality: artifact.quality,
        productModel: serializeProductModel(artifact.productModel),
      },
      editorConfig: {
        slot: 'accessory',
        element: '火',
        realm: '筑基',
        realmStage: '后期',
        affixIds: ['artifact-panel-atk'],
      },
    });

    expect(buildAttachmentFromItemLibraryEntry(item, 2)).toMatchObject({
      type: 'artifact',
      name: '离火古印',
      quantity: 2,
      data: {
        name: '离火古印',
        productModel: expect.objectContaining({
          productType: 'artifact',
        }),
      },
    });
  });
});
