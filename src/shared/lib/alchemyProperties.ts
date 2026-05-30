import type { ConditionTrackPath } from '@shared/types/condition';
import type {
  AlchemyPropertyKey,
  PillFamily,
  WeightedAlchemyProperty,
} from '@shared/types/consumable';

export const ALCHEMY_PROPERTY_LABELS: Record<AlchemyPropertyKey, string> = {
  restore_hp: '补充气血',
  heal_wounds: '治愈伤势',
  restore_mp: '回补法力',
  detox: '解毒祛浊',
  cultivation: '积蓄修为',
  insight: '澄明悟心',
  clear_mind_support: '清心定神',
  breakthrough_support: '护脉破境',
  tempering_vitality: '炼体·体魄',
  tempering_spirit: '炼体·灵力',
  tempering_wisdom: '炼体·悟性',
  tempering_speed: '炼体·身法',
  tempering_willpower: '炼体·神识',
  marrow_wash: '洗髓伐脉',
};

const PROPERTY_SORT_ORDER: Record<AlchemyPropertyKey, number> = {
  restore_hp: 0,
  heal_wounds: 1,
  restore_mp: 2,
  detox: 3,
  cultivation: 4,
  insight: 5,
  clear_mind_support: 6,
  breakthrough_support: 7,
  tempering_vitality: 8,
  tempering_spirit: 9,
  tempering_wisdom: 10,
  tempering_speed: 11,
  tempering_willpower: 12,
  marrow_wash: 13,
};

export function getAlchemyPropertyLabel(key: AlchemyPropertyKey): string {
  return ALCHEMY_PROPERTY_LABELS[key] ?? key;
}

export function getAlchemyPropertyFamily(
  key: AlchemyPropertyKey,
): Exclude<PillFamily, 'hybrid'> {
  switch (key) {
    case 'restore_hp':
    case 'heal_wounds':
      return 'healing';
    case 'restore_mp':
      return 'mana';
    case 'detox':
      return 'detox';
    case 'cultivation':
      return 'cultivation';
    case 'insight':
      return 'insight';
    case 'clear_mind_support':
    case 'breakthrough_support':
      return 'breakthrough';
    case 'marrow_wash':
      return 'marrow_wash';
    case 'tempering_vitality':
    case 'tempering_spirit':
    case 'tempering_wisdom':
    case 'tempering_speed':
    case 'tempering_willpower':
      return 'tempering';
  }
}

export function getAlchemyPropertyTrackPath(
  key: AlchemyPropertyKey,
): Extract<ConditionTrackPath, `tempering.${string}`> | null {
  switch (key) {
    case 'tempering_vitality':
      return 'tempering.vitality';
    case 'tempering_spirit':
      return 'tempering.spirit';
    case 'tempering_wisdom':
      return 'tempering.wisdom';
    case 'tempering_speed':
      return 'tempering.speed';
    case 'tempering_willpower':
      return 'tempering.willpower';
    default:
      return null;
  }
}

export function isLongTermAlchemyProperty(key: AlchemyPropertyKey): boolean {
  return (
    key === 'cultivation' ||
    key === 'insight' ||
    key === 'clear_mind_support' ||
    key === 'breakthrough_support' ||
    key === 'marrow_wash' ||
    key.startsWith('tempering_')
  );
}

export function sortWeightedAlchemyProperties(
  properties: WeightedAlchemyProperty[],
): WeightedAlchemyProperty[] {
  return [...properties].sort((left, right) => {
    if (right.weight !== left.weight) {
      return right.weight - left.weight;
    }
    return PROPERTY_SORT_ORDER[left.key] - PROPERTY_SORT_ORDER[right.key];
  });
}

export function normalizeWeightedAlchemyProperties(
  properties: WeightedAlchemyProperty[],
): WeightedAlchemyProperty[] {
  const totals = new Map<AlchemyPropertyKey, number>();

  for (const property of properties) {
    if (!Number.isFinite(property.weight) || property.weight <= 0) {
      continue;
    }
    totals.set(property.key, (totals.get(property.key) ?? 0) + property.weight);
  }

  const totalWeight = [...totals.values()].reduce(
    (sum, value) => sum + value,
    0,
  );
  if (totalWeight <= 0) {
    return [];
  }

  return sortWeightedAlchemyProperties(
    [...totals.entries()].map(([key, weight]) => ({
      key,
      weight: Number((weight / totalWeight).toFixed(4)),
    })),
  );
}

export function formatAlchemyPropertyPercent(weight: number): string {
  const percent = Number((weight * 100).toFixed(1));
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent}%`;
}

export function formatAlchemyPropertyVector(
  properties: WeightedAlchemyProperty[],
): string {
  if (properties.length === 0) return '无';
  return sortWeightedAlchemyProperties(properties)
    .map(
      (property) =>
        `${getAlchemyPropertyLabel(property.key)} ${formatAlchemyPropertyPercent(property.weight)}`,
    )
    .join('、');
}
