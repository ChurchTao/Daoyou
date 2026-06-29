import type { PillSpec } from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConsumableListCard } from './ConsumableListCard';

function createPill(): Consumable & { spec: PillSpec } {
  return {
    name: '回春丹',
    type: '丹药',
    quality: '玄品',
    quantity: 2,
    score: 0,
    description: '药香温润。',
    spec: {
      kind: 'pill',
      family: 'healing',
      operations: [
        {
          type: 'restore_resource',
          resource: 'hp',
          mode: 'percent',
          value: 0.24,
        },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'none',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['回春草'],
        analysisVersion: 2,
        propertyVector: [{ key: 'restore_hp', weight: 1 }],
        sourceMaterialVectors: [],
        stability: 72,
        toxicityRating: 4,
        tags: ['healing'],
      },
    },
  };
}

describe('ConsumableListCard', () => {
  it('renders a subdued pill score mark for pills', () => {
    const html = renderToStaticMarkup(
      <ConsumableListCard consumable={createPill()} />,
    );

    expect(html).toContain('评分 ');
  });
});
