import {
  ALCHEMY_ALLOWED_MATERIAL_TYPES,
  BASE_STABILITY_BY_TYPE,
  BASE_TOXICITY_BY_TYPE,
  MATERIAL_ALCHEMY_TAG_LABELS,
  POTENCY_BY_QUALITY,
  QUALITY_STABILITY_BONUS,
  type AlchemyMaterialType,
} from '@shared/config/alchemyProfile';
import type { ConditionTrackPath } from '@shared/types/condition';
import type { ElementType, MaterialType, Quality } from '@shared/types/constants';
import type { MaterialDetails } from '@shared/types/cultivator';
import {
  MATERIAL_ALCHEMY_EFFECT_TAG_VALUES,
  type MaterialAlchemyEffectTag,
  type MaterialAlchemyProfile,
  type PillFamily,
} from '@shared/types/consumable';

const ALCHEMY_ALLOWED_MATERIAL_TYPE_SET = new Set<MaterialType>(
  ALCHEMY_ALLOWED_MATERIAL_TYPES,
);
const MATERIAL_ALCHEMY_EFFECT_TAG_SET = new Set<string>(
  MATERIAL_ALCHEMY_EFFECT_TAG_VALUES,
);

const ORE_TEMPERING_TAG_BY_ELEMENT: Record<
  ElementType,
  Extract<MaterialAlchemyEffectTag, `tempering_${string}`>
> = {
  金: 'tempering_vitality',
  木: 'tempering_spirit',
  水: 'tempering_wisdom',
  火: 'tempering_spirit',
  土: 'tempering_vitality',
  风: 'tempering_speed',
  雷: 'tempering_willpower',
  冰: 'tempering_wisdom',
};

const HERB_TAGS_BY_ELEMENT: Record<ElementType, MaterialAlchemyEffectTag[]> = {
  金: ['mana'],
  木: ['healing'],
  水: ['mana'],
  火: ['breakthrough'],
  土: ['healing'],
  风: ['mana', 'detox'],
  雷: ['breakthrough'],
  冰: ['detox'],
};

const MONSTER_TAGS_BY_ELEMENT: Record<ElementType, MaterialAlchemyEffectTag[]> = {
  金: ['tempering_vitality'],
  木: ['tempering_spirit'],
  水: ['marrow_wash'],
  火: ['breakthrough'],
  土: ['tempering_vitality'],
  风: ['breakthrough'],
  雷: ['breakthrough'],
  冰: ['marrow_wash'],
};

const TCDB_TAGS_BY_ELEMENT: Record<ElementType, MaterialAlchemyEffectTag[]> = {
  金: ['mana'],
  木: ['marrow_wash'],
  水: ['mana'],
  火: ['breakthrough'],
  土: ['marrow_wash'],
  风: ['healing', 'mana'],
  雷: ['breakthrough'],
  冰: ['detox'],
};

const AUX_TAGS_BY_ELEMENT: Record<ElementType, MaterialAlchemyEffectTag[]> = {
  金: ['detox', 'mana'],
  木: ['detox', 'healing'],
  水: ['detox', 'mana'],
  火: ['detox', 'breakthrough'],
  土: ['detox', 'healing'],
  风: ['detox', 'mana'],
  雷: ['detox', 'breakthrough'],
  冰: ['detox', 'detox'],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function dedupeTags(
  tags: MaterialAlchemyEffectTag[],
): MaterialAlchemyEffectTag[] {
  return Array.from(new Set(tags));
}

function resolveEffectTags(
  type: AlchemyMaterialType,
  element: ElementType,
): MaterialAlchemyEffectTag[] {
  switch (type) {
    case 'herb':
      return HERB_TAGS_BY_ELEMENT[element];
    case 'ore':
      return [ORE_TEMPERING_TAG_BY_ELEMENT[element]];
    case 'monster':
      return MONSTER_TAGS_BY_ELEMENT[element];
    case 'tcdb':
      return TCDB_TAGS_BY_ELEMENT[element];
    case 'aux':
      return dedupeTags(AUX_TAGS_BY_ELEMENT[element]);
  }
}

export function isAlchemyMaterialType(
  type: MaterialType,
): type is AlchemyMaterialType {
  return ALCHEMY_ALLOWED_MATERIAL_TYPE_SET.has(type);
}

export function buildMaterialAlchemyProfile(
  type: AlchemyMaterialType,
  rank: Quality,
  element: ElementType,
): MaterialAlchemyProfile {
  return {
    effectTags: resolveEffectTags(type, element),
    elementBias: element,
    potency: POTENCY_BY_QUALITY[rank],
    toxicity: BASE_TOXICITY_BY_TYPE[type],
    stability: clamp(
      BASE_STABILITY_BY_TYPE[type] + QUALITY_STABILITY_BONUS[rank],
      0,
      100,
    ),
  };
}

export function readMaterialAlchemyProfile(
  details: MaterialDetails | Record<string, unknown> | null | undefined,
): MaterialAlchemyProfile | null {
  if (!isRecord(details) || !isRecord(details.alchemyProfile)) {
    return null;
  }

  const effectTags = Array.isArray(details.alchemyProfile.effectTags)
    ? details.alchemyProfile.effectTags.filter(
        (tag): tag is MaterialAlchemyEffectTag =>
          typeof tag === 'string' && MATERIAL_ALCHEMY_EFFECT_TAG_SET.has(tag),
      )
    : [];

  if (
    effectTags.length === 0 ||
    typeof details.alchemyProfile.potency !== 'number' ||
    !Number.isFinite(details.alchemyProfile.potency) ||
    typeof details.alchemyProfile.toxicity !== 'number' ||
    !Number.isFinite(details.alchemyProfile.toxicity) ||
    typeof details.alchemyProfile.stability !== 'number' ||
    !Number.isFinite(details.alchemyProfile.stability)
  ) {
    return null;
  }

  return {
    effectTags,
    elementBias:
      typeof details.alchemyProfile.elementBias === 'string'
        ? (details.alchemyProfile.elementBias as ElementType)
        : undefined,
    potency: details.alchemyProfile.potency,
    toxicity: details.alchemyProfile.toxicity,
    stability: details.alchemyProfile.stability,
  };
}

export function getMaterialAlchemyTagFamily(
  tag: MaterialAlchemyEffectTag,
): Exclude<PillFamily, 'hybrid'> {
  switch (tag) {
    case 'healing':
    case 'mana':
    case 'detox':
    case 'breakthrough':
    case 'marrow_wash':
      return tag;
    case 'tempering_vitality':
    case 'tempering_spirit':
    case 'tempering_wisdom':
    case 'tempering_speed':
    case 'tempering_willpower':
      return 'tempering';
  }
}

export function getMaterialAlchemyTrackPath(
  tag: MaterialAlchemyEffectTag,
): Extract<ConditionTrackPath, `tempering.${string}`> | null {
  switch (tag) {
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

export function getTrackPathAlchemyTag(
  track: Extract<ConditionTrackPath, `tempering.${string}`>,
): Extract<MaterialAlchemyEffectTag, `tempering_${string}`> {
  switch (track) {
    case 'tempering.vitality':
      return 'tempering_vitality';
    case 'tempering.spirit':
      return 'tempering_spirit';
    case 'tempering.wisdom':
      return 'tempering_wisdom';
    case 'tempering.speed':
      return 'tempering_speed';
    case 'tempering.willpower':
      return 'tempering_willpower';
  }
}

export function getMaterialAlchemyTagLabel(
  tag: MaterialAlchemyEffectTag,
): string {
  return MATERIAL_ALCHEMY_TAG_LABELS[tag] ?? tag;
}
