import { describe, expect, it } from 'vitest';

import { consumableSchema } from '@shared/contracts/resources/inventory';
import {
  ItemLibraryConsumablePayloadSchema,
  ItemLibraryMaterialPayloadSchema,
  buildAttachmentFromItemLibraryEntry,
} from './itemLibrary';

function buildPillPayload() {
  return {
    name: '养元丹',
    type: '丹药',
    quality: '凡品',
    spec: {
      kind: 'pill',
      family: 'healing',
      operations: [
        {
          type: 'restore_resource',
          resource: 'hp',
          mode: 'flat',
          value: 100,
        },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: [],
        analysisVersion: 2,
        propertyVector: [],
        sourceMaterialVectors: [],
        stability: 80,
        toxicityRating: 5,
        tags: ['healing'],
      },
    },
  };
}

describe('ItemLibraryConsumablePayloadSchema', () => {
  it('preserves complete pill analysis metadata', () => {
    const parsed = ItemLibraryConsumablePayloadSchema.parse(buildPillPayload());

    expect(parsed.spec.kind).toBe('pill');
    if (parsed.spec.kind !== 'pill') return;
    expect(parsed.spec.alchemyMeta).toMatchObject({
      analysisVersion: 2,
      propertyVector: [],
      sourceMaterialVectors: [],
    });
  });

  it('accepts pills without optional analysis metadata', () => {
    const payload = buildPillPayload();
    const incomplete = {
      ...payload,
      spec: {
        ...payload.spec,
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: [],
          stability: 80,
          toxicityRating: 5,
          tags: ['healing'],
        },
      },
    };

    const parsed = ItemLibraryConsumablePayloadSchema.parse(incomplete);

    expect(parsed.spec.kind).toBe('pill');
    if (parsed.spec.kind !== 'pill') return;
    expect(parsed.spec.alchemyMeta.analysisVersion).toBeUndefined();
    expect(parsed.spec.alchemyMeta.propertyVector).toBeUndefined();
    expect(parsed.spec.alchemyMeta.sourceMaterialVectors).toBeUndefined();
  });

  it('allows inventory responses to omit analysis metadata', () => {
    const payload = buildPillPayload();
    const { analysisVersion, propertyVector, sourceMaterialVectors, ...meta } =
      payload.spec.alchemyMeta;

    expect(
      consumableSchema.parse({
        ...payload,
        quantity: 1,
        spec: {
          ...payload.spec,
          alchemyMeta: meta,
        },
      }),
    ).toMatchObject({
      name: '养元丹',
      quantity: 1,
    });

    expect(analysisVersion).toBe(2);
    expect(propertyVector).toEqual([]);
    expect(sourceMaterialVectors).toEqual([]);
  });
});

describe('ItemLibraryMaterialPayloadSchema', () => {
  it('preserves hidden spirit-seed details when building a reward attachment', () => {
    const payload = ItemLibraryMaterialPayloadSchema.parse({
      name: '青纹眠籽',
      type: 'seed',
      rank: '玄品',
      element: '木',
      description: '种壳中蕴着尚未定形的生机。',
      details: {
        seedSpec: {
          version: 1,
          fingerprint: 'seed-v1-example',
          plant: { seedName: '青纹眠籽' },
        },
      },
    });
    const attachment = buildAttachmentFromItemLibraryEntry(
      {
        id: '00000000-0000-4000-8000-000000000001',
        itemId: 'mat_seed_example',
        type: 'material',
        status: 'published',
        name: payload.name,
        description: payload.description,
        quality: payload.rank,
        element: payload.element,
        category: payload.type,
        payload,
        editorConfig: {},
        createdBy: '00000000-0000-4000-8000-000000000002',
        updatedBy: '00000000-0000-4000-8000-000000000002',
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      2,
    );

    expect(attachment.type).toBe('material');
    if (attachment.type !== 'material') return;
    expect(attachment.data.details).toEqual(payload.details);
    expect(attachment.data.quantity).toBe(2);
  });
});
