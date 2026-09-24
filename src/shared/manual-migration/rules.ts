import type {
  ManualMigrationConfig,
  ManualMigrationGrant,
  ManualMigrationPolicy,
  ManualMigrationSource,
} from '../contracts/manualMigration';
import { ManualMigrationConfigSchema } from '../contracts/manualMigration';
import { CHARACTER_MANUALS_V1 } from '../engine/combat-v6/manuals/content';
import { BASE_PRICES } from '../engine/material/creation/config';
import type { ItemGrant } from '../inventory';
import { ConsumableFactsSchema } from '../items/definitions/consumables';
import { QUALITY_VALUES, type Quality } from '../types/constants';

export const manualMigrationInsightFacts = ConsumableFactsSchema.parse({
  name: '感悟果',
  type: '灵果',
  quality: '玄品',
  description:
    '旧神品功法的传承补偿。每颗增加 50 点道心感悟。建议感悟不高于 50 时服用，超过 100 上限的部分不保留；感悟已满时无法服用。',
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

const realms = ['炼气', '筑基', '金丹', '元婴'];
const counts = [1, 2, 3, 3, 3, 4, 4, 6];
const ranges = [[0], [0, 1], [0, 1, 2], [1, 2, 3], [2, 3], [2, 3], [3], [3]];
const realmPrices = [
  BASE_PRICES.玄品,
  BASE_PRICES.真品,
  BASE_PRICES.地品,
  BASE_PRICES.天品,
];

/** Fixed compensation rules for the temporary migration; keep unchanged until it ends. */
export function buildManualMigrationPolicy(
  config: ManualMigrationConfig,
): ManualMigrationPolicy {
  ManualMigrationConfigSchema.parse(config);
  return {
    config: { ...config },
    rules: Object.fromEntries(
      QUALITY_VALUES.map((quality, i) => {
        const weights = ranges[i].map((r) => 1 / realmPrices[r]);
        const total = weights.reduce((n, w) => n + w, 0);
        return [
          quality,
          {
            count: counts[i],
            realms: ranges[i].map((r) => realms[r]),
            weights: weights.map((w) => w / total),
          },
        ];
      }),
    ) as ManualMigrationPolicy['rules'],
    catalog: CHARACTER_MANUALS_V1.map((m) => ({
      definitionId: `jade.${m.id}`,
      name: m.name,
      realm: m.realm,
    })),
  };
}
export function manualMigrationPlan(
  source: ManualMigrationSource,
  policy: ManualMigrationPolicy,
) {
  if (!QUALITY_VALUES.includes(source.quality as Quality))
    throw new Error('旧功法品质缺失或无效，请联系管理员核对');
  if (!Number.isSafeInteger(source.score) || source.score <= 0)
    throw new Error('旧功法评分异常，请联系管理员核对');
  const rule = policy.rules[source.quality as Quality];
  const choices =
    source.score >= policy.config.s3
      ? 2
      : source.score >= policy.config.s2
        ? 1
        : 0;
  const bonusGrants: ItemGrant[] =
    source.quality === '神品'
      ? [
          {
            definitionId: 'consumable.v1',
            quantity: 1,
            instanceData: manualMigrationInsightFacts,
          },
        ]
      : [];
  return { ...rule, choices, bonusGrants };
}
export function drawLegacyManual(
  source: ManualMigrationSource,
  policy: ManualMigrationPolicy,
  random: () => number,
): ManualMigrationGrant[] {
  const plan = manualMigrationPlan(source, policy);
  const grants = new Map<string, number>();
  const roll = () => {
    const value = random();
    if (!Number.isFinite(value) || value < 0 || value >= 1)
      throw new Error('抽取随机值无效');
    return value;
  };
  for (let i = 0; i < plan.count; i++) {
    const value = roll();
    let cumulative = 0;
    let realm = plan.realms[plan.realms.length - 1];
    for (let r = 0; r < plan.realms.length; r++) {
      cumulative += plan.weights[r];
      if (value < cumulative) {
        realm = plan.realms[r];
        break;
      }
    }
    const pool = policy.catalog.filter((m) => m.realm === realm);
    if (!pool.length) throw new Error('补偿功法池缺失');
    const id = pool[Math.floor(roll() * pool.length)].definitionId;
    grants.set(id, (grants.get(id) ?? 0) + 1);
  }
  return Array.from(grants, ([definitionId, quantity]) => ({
    definitionId,
    quantity,
  }));
}
export function validateManualSelection(
  grants: ManualMigrationGrant[],
  required: number,
  policy: ManualMigrationPolicy,
): number {
  if (new Set(grants.map((g) => g.definitionId)).size !== grants.length)
    throw new Error('同名玉简数量请合并');
  for (const grant of grants) {
    if (
      !Number.isSafeInteger(grant.quantity) ||
      grant.quantity < 1 ||
      !policy.catalog.some((m) => m.definitionId === grant.definitionId)
    )
      throw new Error('自选玉简或数量无效');
  }
  const total = grants.reduce((n, g) => n + g.quantity, 0);
  if (total !== required)
    throw new Error(`本次需要选满 ${required} 本自选玉简`);
  return total;
}
