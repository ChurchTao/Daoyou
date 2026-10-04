import { describe, expect, it } from 'vitest';
import { consumableSchema } from './inventory.js';
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

describe('inventory consumable metadata', () => {
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
