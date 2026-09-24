import { CHARACTER_MANUALS_V1 } from '../engine/combat-v6/manuals/content';
import {
  BASE_PRICES,
  TYPE_MULTIPLIERS,
} from '../engine/material/creation/config';
import {
  emptySlot,
  InventoryRuleError,
  type InventoryItem,
} from '../inventory';
import { inventoryStackIdentity } from '../inventory/stack-key';
import { MaterialFactsSchema } from '../items/definitions/materials';
import { REALM_VALUES, type Quality, type RealmType } from '../types/constants';

export const ENLIGHTENMENT_QUALITIES = [
  '凡品',
  '灵品',
  '玄品',
  '真品',
  '地品',
  '天品',
] as const;
export const ENLIGHTENMENT_REALMS = ['炼气', '筑基', '金丹', '元婴'] as const;
const insightCosts = [1, 2, 3, 5, 8, 12];
const supports = [[0], [0, 1], [0, 1, 2], [1, 2, 3], [2, 3], [3]];
export type EnlightenmentRef = {
  id: string;
  revision: number;
  quantity: number;
};

export function enlightenmentQualityCap(realm: RealmType) {
  return ENLIGHTENMENT_QUALITIES[Math.min(5, REALM_VALUES.indexOf(realm) + 2)];
}
export function enlightenmentMaterialProblem(
  item: Pick<InventoryItem, 'definitionId' | 'instanceData' | 'location'>,
  realm: RealmType,
): string | null {
  if (item.location !== 'bag') return '请先将典籍取入储物袋';
  const parsed = MaterialFactsSchema.safeParse(item.instanceData);
  if (
    item.definitionId !== 'material.v1' ||
    !parsed.success ||
    parsed.data.type !== 'gongfa_manual'
  )
    return '请选择功法典籍';
  const rank = ENLIGHTENMENT_QUALITIES.findIndex((q) => q === parsed.data.rank);
  if (rank < 0) return '当前最高支持天品典籍';
  if (rank > Math.min(5, REALM_VALUES.indexOf(realm) + 2))
    return `需${ENLIGHTENMENT_REALMS[rank - 2]}境界`;
  return null;
}
export function enlightenmentDistribution(quality: Quality): number[] {
  const rank = ENLIGHTENMENT_QUALITIES.findIndex((q) => q === quality);
  if (rank < 0) throw new InventoryRuleError('当前最高支持天品典籍');
  const weights = ENLIGHTENMENT_REALMS.map((_, r) =>
    supports[rank].includes(r)
      ? 1 /
        (BASE_PRICES[ENLIGHTENMENT_QUALITIES[r + 2]] *
          TYPE_MULTIPLIERS.gongfa_manual)
      : 0,
  );
  const total = weights.reduce((sum, w) => sum + w, 0);
  return weights.map((w) => w / total);
}
export function previewEnlightenment(
  qualities: Quality[],
  insightMultiplier: number,
) {
  if (qualities.length < 1 || qualities.length > 4)
    throw new InventoryRuleError('请投入一至四本典籍');
  if (!Number.isFinite(insightMultiplier) || insightMultiplier < 0)
    throw new InventoryRuleError('命格费用无效');
  let qi = 0;
  let baseInsight = 0;
  const probabilities = [0, 0, 0, 0];
  for (const quality of qualities) {
    const distribution = enlightenmentDistribution(quality);
    const rank = ENLIGHTENMENT_QUALITIES.findIndex((q) => q === quality);
    qi += rank + 1;
    baseInsight += insightCosts[rank];
    distribution.forEach((p, r) => {
      probabilities[r] += p / 4;
    });
  }
  return {
    successChance: qualities.length / 4,
    probabilities,
    cost: {
      qi,
      baseInsight,
      insight: Math.max(
        1,
        Math.ceil(Number((baseInsight * insightMultiplier).toFixed(8))),
      ),
    },
  };
}
export type EnlightenmentPreview = ReturnType<typeof previewEnlightenment>;

/** Validates the full consumption and every possible reward before any random draw. */
export function prepareEnlightenment(
  items: InventoryItem[],
  refs: EnlightenmentRef[],
  realm: RealmType,
  multiplier: number,
) {
  if (
    !refs.length ||
    refs.length > 4 ||
    new Set(refs.map((r) => r.id)).size !== refs.length
  )
    throw new InventoryRuleError('典籍选择无效');
  const quantities = new Map<string, number>();
  const qualities: Quality[] = [];
  for (const ref of refs) {
    const item = items.find(
      (i) => i.id === ref.id && i.revision === ref.revision,
    );
    if (
      !item ||
      !Number.isInteger(ref.quantity) ||
      ref.quantity < 1 ||
      ref.quantity > 4 ||
      item.quantity < ref.quantity
    )
      throw new InventoryRuleError('典籍已变化，请重新备料');
    const problem = enlightenmentMaterialProblem(item, realm);
    if (problem) throw new InventoryRuleError(problem);
    const facts = MaterialFactsSchema.parse(item.instanceData);
    quantities.set(item.id, ref.quantity);
    for (let n = 0; n < ref.quantity; n++) qualities.push(facts.rank);
  }
  const preview = previewEnlightenment(qualities, multiplier);
  const afterMaterials = items.flatMap((item) => {
    const used = quantities.get(item.id) ?? 0;
    return item.quantity === used
      ? []
      : [
          {
            ...item,
            quantity: item.quantity - used,
            revision: item.revision + Number(used > 0),
          },
        ];
  });
  const candidates = CHARACTER_MANUALS_V1.filter(
    (manual) =>
      preview.probabilities[ENLIGHTENMENT_REALMS.indexOf(manual.realm)] > 0,
  );
  for (let r = 0; r < 4; r++) {
    if (
      preview.probabilities[r] > 0 &&
      !candidates.some((m) => m.realm === ENLIGHTENMENT_REALMS[r])
    )
      throw new InventoryRuleError('该境界功法尚未开放');
  }
  if (
    emptySlot(afterMaterials) === null &&
    candidates.some((manual) => {
      const definitionId = `jade.${manual.id}`;
      return !afterMaterials.some(
        (item) =>
          item.location === 'bag' &&
          item.definitionId === definitionId &&
          item.stackKey === inventoryStackIdentity(definitionId, null) &&
          item.quantity < 99,
      );
    })
  )
    throw new InventoryRuleError(
      '请先腾出一个储物袋空位，以容纳可能悟得的玉简',
    );
  return { preview, afterMaterials };
}

export function rollEnlightenment(
  preview: EnlightenmentPreview,
  random: () => number,
): string | null {
  if (preview.successChance < 1 && random() >= preview.successChance)
    return null;
  const roll = random() * preview.successChance;
  let cumulative = 0;
  let realmIndex = preview.probabilities.reduce(
    (last, p, r) => (p > 0 ? r : last),
    0,
  );
  for (let r = 0; r < 4; r++) {
    cumulative += preview.probabilities[r];
    if (roll < cumulative) {
      realmIndex = r;
      break;
    }
  }
  const pool = CHARACTER_MANUALS_V1.filter(
    (m) => m.realm === ENLIGHTENMENT_REALMS[realmIndex],
  );
  return `jade.${pool[Math.floor(random() * pool.length)].id}`;
}
