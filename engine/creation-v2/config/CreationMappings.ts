import { ElementType } from '@/types/constants';
import { CreationTags } from '../core/GameplayTags';

export const ELEMENT_TAG_TOKENS: Record<ElementType, string> = {
  金: 'Metal',
  木: 'Wood',
  水: 'Water',
  火: 'Fire',
  土: 'Earth',
  风: 'Wind',
  雷: 'Thunder',
  冰: 'Ice',
};

export const ELEMENT_TO_MATERIAL_TAG: Record<ElementType, string> = Object.fromEntries(
  Object.entries(ELEMENT_TAG_TOKENS).map(([element, token]) => [
    element,
    `${CreationTags.MATERIAL.ELEMENT}.${token}`,
  ]),
) as Record<ElementType, string>;

export const ELEMENT_TO_ABILITY_TAG: Record<ElementType, string> = Object.fromEntries(
  Object.entries(ELEMENT_TAG_TOKENS).map(([element, token]) => [
    element,
    `Ability.Element.${token}`,
  ]),
) as Record<ElementType, string>;

export const ELEMENT_NAME_PREFIX: Record<ElementType, string> = {
  金: '碎锋',
  木: '青木',
  水: '流泉',
  火: '焚岳',
  土: '镇岳',
  风: '岚影',
  雷: '惊霆',
  冰: '玄冰',
};