import { ConsumableFactsSchema } from '@daoyou/game-domain/inventory';
import type { ManualMigrationConfig } from '@daoyou/game-domain/legacy/migrations';
import { BASE_PRICES } from '../materials/config.js';

export const manualMigrationInsightFacts = ConsumableFactsSchema.parse({
  name: '感悟果',
  type: '灵果',
  quality: '玄品',
  description:
    '旧神品功法的传承补偿。每颗增加 50 点道心感悟。超过 200 上限的部分不保留；感悟已满时无法服用。',
  spec: {
    kind: 'spirit_fruit',
    family: 'insight',
    operations: [
      { type: 'gain_progress', target: 'comprehension_insight', value: 50 },
    ],
    consumeRules: { scene: 'out_of_battle_only', quotaCategory: 'none' },
    source: { kind: 'spirit_field', version: 1 },
  },
});

export const MANUAL_MIGRATION_CONFIG: ManualMigrationConfig = {
  s2: 3000,
  s3: 3200,
  distribution: 'existing',
};

export const realms = ['炼气', '筑基', '金丹', '元婴'];

export const counts = [1, 2, 3, 3, 3, 4, 4, 6];

export const ranges = [
  [0],
  [0, 1],
  [0, 1, 2],
  [1, 2, 3],
  [2, 3],
  [2, 3],
  [3],
  [3],
];

export const realmPrices = [
  BASE_PRICES.玄品,
  BASE_PRICES.真品,
  BASE_PRICES.地品,
  BASE_PRICES.天品,
];
