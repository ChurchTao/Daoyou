import {
  ELEMENT_TO_RUNTIME_ABILITY_TAG,
  GameplayTags,
} from '@shared/engine/shared/tag-domain';
import type { ElementType } from '@shared/types/constants';
import type { DamageRequestEvent } from '../core/events';
import { DamageSource } from '../core/types';

const SPIRITUAL_ROOT_DAMAGE_MATCH_PER_STRENGTH = 0.002;
const SPIRITUAL_ROOT_DAMAGE_MISMATCH_MULTIPLIER = 0.85;

const RUNTIME_ABILITY_TAG_TO_ELEMENT = Object.fromEntries(
  Object.entries(ELEMENT_TO_RUNTIME_ABILITY_TAG).map(([element, tag]) => [
    tag,
    element as ElementType,
  ]),
) as Record<string, ElementType>;

function collectEventElements(
  event: Pick<DamageRequestEvent, 'ability' | 'buff'>,
): ElementType[] {
  const matched = new Set<ElementType>();
  const tags = [
    ...(event.ability?.tags.getTags() ?? []),
    ...(event.buff?.tags.getTags() ?? []),
  ];

  for (const tag of tags) {
    const element = RUNTIME_ABILITY_TAG_TO_ELEMENT[tag];
    if (element) {
      matched.add(element);
    }
  }

  return Array.from(matched);
}

export function calculateSpiritualRootDamageMultiplier(
  event: Pick<DamageRequestEvent, 'ability' | 'buff' | 'caster' | 'damageSource'>,
): number {
  if (event.damageSource === DamageSource.REFLECT) {
    return 1;
  }

  const elements = collectEventElements(event);
  if (elements.length === 0) {
    return 1;
  }

  const spiritualRoots = event.caster?.getSpiritualRoots() ?? [];
  let strongestMatchedStrength = -1;

  for (const root of spiritualRoots) {
    if (elements.includes(root.element) && root.strength > strongestMatchedStrength) {
      strongestMatchedStrength = root.strength;
    }
  }

  if (strongestMatchedStrength >= 0) {
    return 1 + strongestMatchedStrength * SPIRITUAL_ROOT_DAMAGE_MATCH_PER_STRENGTH;
  }

  const ignoresMismatch =
    event.ability?.tags.hasTag(
      GameplayTags.ABILITY.MECHANIC.IGNORE_SPIRITUAL_ROOT_MISMATCH,
    ) ||
    event.buff?.tags.hasTag(
      GameplayTags.ABILITY.MECHANIC.IGNORE_SPIRITUAL_ROOT_MISMATCH,
    );
  if (ignoresMismatch) {
    return 1;
  }

  return SPIRITUAL_ROOT_DAMAGE_MISMATCH_MULTIPLIER;
}
