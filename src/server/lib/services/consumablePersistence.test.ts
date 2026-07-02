import type { PillSpec } from '@shared/types/consumable';
import { describe, expect, it } from 'vitest';
import {
  mapConsumableCraftResult,
  mapConsumableRow,
  type ConsumableRow,
} from './consumablePersistence';

const pillSpec: PillSpec = {
  kind: 'pill',
  family: 'healing',
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
  alchemyMeta: {
    source: 'formula',
    formulaId: '11111111-1111-4111-8111-111111111111',
    sourceMaterials: ['青岚草'],
    analysisVersion: 2,
    propertyVector: [{ key: 'restore_hp', weight: 1 }],
    sourceMaterialVectors: [
      {
        materialRef: 'material_1',
        materialName: '青岚草',
        properties: [{ key: 'restore_hp', weight: 1 }],
      },
    ],
    fitScore: 1,
    fitBand: 'aligned',
    fitMultiplier: 1.05,
    stability: 72,
    toxicityRating: 5,
    tags: ['restore_hp', 'healing'],
  },
};

const stackedRow: ConsumableRow = {
  id: '22222222-2222-4222-8222-222222222222',
  cultivatorId: '33333333-3333-4333-8333-333333333333',
  name: '青木疗伤丹',
  type: '丹药',
  prompt: '',
  quality: '真品',
  spec: pillSpec,
  quantity: 15,
  description: '已入旧瓶的新丹。',
  score: 120,
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
};

describe('consumablePersistence', () => {
  it('keeps inventory stack quantity for normal row mapping', () => {
    expect(mapConsumableRow(stackedRow)).toMatchObject({
      id: stackedRow.id,
      quantity: 15,
    });
  });

  it('uses crafted batch quantity for alchemy craft results', () => {
    expect(mapConsumableCraftResult(stackedRow, 5)).toMatchObject({
      id: stackedRow.id,
      quantity: 5,
    });
  });
});
