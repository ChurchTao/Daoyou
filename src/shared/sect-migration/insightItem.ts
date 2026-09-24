import type { ItemGrant } from '../inventory';
import { ConsumableFactsSchema } from '../items/definitions/consumables';

export const MIGRATION_INSIGHT_PER_FRUIT = 50;

// Self-contained facts: consumable.v1 remains usable after this tool is removed.
// 玄品 is inside the existing allowed quality range for every character realm.
export const migrationInsightFacts = ConsumableFactsSchema.parse({
  name: '宗门感悟果',
  type: '灵果',
  quality: '玄品',
  description:
    '宗门传承改版的经脉投入补偿。每颗增加 50 点道心感悟，可按需分次服用。建议感悟不高于 50 时服用，超过 100 上限的部分不保留；感悟已满时无法服用。',
  spec: {
    kind: 'spirit_fruit',
    family: 'insight',
    operations: [
      {
        type: 'gain_progress',
        target: 'comprehension_insight',
        value: MIGRATION_INSIGHT_PER_FRUIT,
      },
    ],
    consumeRules: { scene: 'out_of_battle_only', quotaCategory: 'none' },
    source: { kind: 'spirit_field', version: 1 },
  },
});

export function migrationInsightQuantity(points: number): number {
  if (
    !Number.isInteger(points) ||
    points < 0 ||
    points > 600 ||
    points % MIGRATION_INSIGHT_PER_FRUIT !== 0
  )
    throw new Error('经脉感悟退款数量无效');
  return points / MIGRATION_INSIGHT_PER_FRUIT;
}

export function migrationInsightGrants(points: number): ItemGrant[] {
  const quantity = migrationInsightQuantity(points);
  return quantity === 0
    ? []
    : [
        {
          definitionId: 'consumable.v1',
          quantity,
          instanceData: migrationInsightFacts,
        },
      ];
}
