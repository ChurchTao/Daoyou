import type { ConditionTrackPath } from '@shared/types/condition';
import type {
  AlchemyPropertyKey,
  CompatibleAlchemyPropertyKey,
  CompatibleWeightedAlchemyProperty,
  LegacyAlchemyPropertyKey,
  PillFamily,
  WeightedAlchemyProperty,
} from '@shared/types/consumable';
import { ALCHEMY_PROPERTY_KEY_VALUES } from '@shared/types/consumable';
import { getGameConceptLabel } from './gameConceptDisplay';

export const ALCHEMY_PROPERTY_LABELS: Record<AlchemyPropertyKey, string> = {
  restore_hp: `补充${getGameConceptLabel('hp')}`,
  heal_wounds: '治愈伤势',
  restore_mp: `回补${getGameConceptLabel('mp')}`,
  detox: '解毒祛浊',
  cultivation: `积蓄${getGameConceptLabel('cultivation_exp')}`,
  insight: `澄明${getGameConceptLabel('comprehension_insight')}`,
  clear_mind_support: '清心定神',
  protect_meridians_support: '护脉稳络',
  breakthrough_support: '冲关蓄势',
  extend_lifespan: `延长${getGameConceptLabel('lifespan')}`,
  body_skin: '炼体·皮肤',
  body_sinew_bone: '炼体·筋骨',
  body_organs: '炼体·脏腑',
  body_qi_blood: '炼体·气血',
  body_primordial_spirit: '炼体·元神',
  marrow_wash: '洗髓伐脉',
};

const LEGACY_ALCHEMY_PROPERTY_LABELS: Record<LegacyAlchemyPropertyKey, string> = {
  tempering_vitality: '炼体·气血',
  tempering_spirit: '炼体·脏腑',
  tempering_wisdom: '炼体·元神',
  tempering_speed: '炼体·皮肤',
  tempering_willpower: '炼体·筋骨',
};

const PROPERTY_SORT_ORDER: Record<CompatibleAlchemyPropertyKey, number> = {
  restore_hp: 0,
  heal_wounds: 1,
  restore_mp: 2,
  detox: 3,
  cultivation: 4,
  insight: 5,
  clear_mind_support: 6,
  protect_meridians_support: 7,
  breakthrough_support: 8,
  extend_lifespan: 9,
  body_skin: 10,
  body_sinew_bone: 11,
  body_organs: 12,
  body_qi_blood: 13,
  body_primordial_spirit: 14,
  tempering_vitality: 15,
  tempering_spirit: 16,
  tempering_wisdom: 17,
  tempering_speed: 18,
  tempering_willpower: 19,
  marrow_wash: 20,
};

const LEGACY_TEMPERING_PROPERTY_TO_BODY_PROPERTY: Partial<
  Record<CompatibleAlchemyPropertyKey, AlchemyPropertyKey>
> = {
  tempering_vitality: 'body_qi_blood',
  tempering_spirit: 'body_organs',
  tempering_wisdom: 'body_primordial_spirit',
  tempering_speed: 'body_skin',
  tempering_willpower: 'body_sinew_bone',
};

export const GENERATABLE_ALCHEMY_PROPERTY_KEY_VALUES =
  ALCHEMY_PROPERTY_KEY_VALUES;

export function getAlchemyPropertyLabel(
  key: CompatibleAlchemyPropertyKey,
): string {
  return ALCHEMY_PROPERTY_LABELS[key as AlchemyPropertyKey] ??
    LEGACY_ALCHEMY_PROPERTY_LABELS[key as LegacyAlchemyPropertyKey] ??
    key;
}

export function canonicalizeAlchemyPropertyKey(
  key: CompatibleAlchemyPropertyKey,
): AlchemyPropertyKey {
  return LEGACY_TEMPERING_PROPERTY_TO_BODY_PROPERTY[key] ?? (key as AlchemyPropertyKey);
}

export function canonicalizeWeightedAlchemyProperties(
  properties: CompatibleWeightedAlchemyProperty[],
): WeightedAlchemyProperty[] {
  return properties.map((property) => ({
    ...property,
    key: canonicalizeAlchemyPropertyKey(property.key),
  }));
}

export function getAlchemyPropertyFamily(
  key: CompatibleAlchemyPropertyKey,
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
    case 'protect_meridians_support':
    case 'breakthrough_support':
      return 'breakthrough';
    case 'extend_lifespan':
      return 'longevity';
    case 'marrow_wash':
      return 'marrow_wash';
    case 'body_skin':
    case 'body_sinew_bone':
    case 'body_organs':
    case 'body_qi_blood':
    case 'body_primordial_spirit':
    case 'tempering_vitality':
    case 'tempering_spirit':
    case 'tempering_wisdom':
    case 'tempering_speed':
    case 'tempering_willpower':
      return 'tempering';
  }
}

export function getAlchemyPropertyTrackPath(
  key: CompatibleAlchemyPropertyKey,
): Extract<ConditionTrackPath, `body.${string}`> | null {
  switch (key) {
    case 'body_skin':
      return 'body.skin';
    case 'body_sinew_bone':
      return 'body.sinew_bone';
    case 'body_organs':
      return 'body.organs';
    case 'body_qi_blood':
      return 'body.qi_blood';
    case 'body_primordial_spirit':
      return 'body.primordial_spirit';
    case 'tempering_vitality':
      return 'body.qi_blood';
    case 'tempering_spirit':
      return 'body.organs';
    case 'tempering_wisdom':
      return 'body.primordial_spirit';
    case 'tempering_speed':
      return 'body.skin';
    case 'tempering_willpower':
      return 'body.sinew_bone';
    default:
      return null;
  }
}

export function isLongTermAlchemyProperty(
  key: CompatibleAlchemyPropertyKey,
): boolean {
  return (
    key === 'cultivation' ||
    key === 'insight' ||
    key === 'clear_mind_support' ||
    key === 'protect_meridians_support' ||
    key === 'breakthrough_support' ||
    key === 'extend_lifespan' ||
    key === 'marrow_wash' ||
    key.startsWith('body_') ||
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
  properties: CompatibleWeightedAlchemyProperty[],
): WeightedAlchemyProperty[] {
  const totals = new Map<AlchemyPropertyKey, number>();

  for (const property of canonicalizeWeightedAlchemyProperties(properties)) {
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
