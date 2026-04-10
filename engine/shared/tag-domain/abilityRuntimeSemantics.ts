import type { ElementType } from '@/types/constants';
import { assertRuntimeTag } from './guards';
import { GameplayTags } from './gameplayTags';

export type AbilityFunctionSemantic = 'damage' | 'heal' | 'control';
export type AbilityChannelSemantic = 'magic' | 'physical' | 'true';
export type AbilityKindSemantic = 'skill' | 'passive' | 'artifact' | 'gongfa';
export type AbilityTargetSemantic = 'single' | 'aoe';
export type AbilityTraitSemantic =
  | 'execute'
  | 'reflect'
  | 'lifesteal'
  | 'mana_thief'
  | 'shield_master'
  | 'berserker'
  | 'cooldown';

export interface AbilityRuntimeSemantics {
  functions?: AbilityFunctionSemantic[];
  channel?: AbilityChannelSemantic;
  kind?: AbilityKindSemantic;
  elements?: ElementType[];
  targets?: AbilityTargetSemantic[];
  traits?: AbilityTraitSemantic[];
}

export const ABILITY_FUNCTION_TO_TAG: Record<
  AbilityFunctionSemantic,
  string
> = {
  damage: GameplayTags.ABILITY.FUNCTION.DAMAGE,
  heal: GameplayTags.ABILITY.FUNCTION.HEAL,
  control: GameplayTags.ABILITY.FUNCTION.CONTROL,
};

export const ABILITY_CHANNEL_TO_TAG: Record<
  AbilityChannelSemantic,
  string
> = {
  magic: GameplayTags.ABILITY.CHANNEL.MAGIC,
  physical: GameplayTags.ABILITY.CHANNEL.PHYSICAL,
  true: GameplayTags.ABILITY.CHANNEL.TRUE,
};

export const ABILITY_KIND_TO_TAG: Record<AbilityKindSemantic, string> = {
  skill: GameplayTags.ABILITY.KIND.SKILL,
  passive: GameplayTags.ABILITY.KIND.PASSIVE,
  artifact: GameplayTags.ABILITY.KIND.ARTIFACT,
  gongfa: GameplayTags.ABILITY.KIND.GONGFA,
};

export const ELEMENT_TO_RUNTIME_ABILITY_TAG: Record<ElementType, string> = {
  金: GameplayTags.ABILITY.ELEMENT.METAL,
  木: GameplayTags.ABILITY.ELEMENT.WOOD,
  水: GameplayTags.ABILITY.ELEMENT.WATER,
  火: GameplayTags.ABILITY.ELEMENT.FIRE,
  土: GameplayTags.ABILITY.ELEMENT.EARTH,
  风: GameplayTags.ABILITY.ELEMENT.WIND,
  雷: GameplayTags.ABILITY.ELEMENT.THUNDER,
  冰: GameplayTags.ABILITY.ELEMENT.ICE,
};

export const ABILITY_TARGET_TO_TAG: Record<AbilityTargetSemantic, string> = {
  single: GameplayTags.ABILITY.TARGET.SINGLE,
  aoe: GameplayTags.ABILITY.TARGET.AOE,
};

export const ABILITY_TRAIT_TO_TAG: Record<AbilityTraitSemantic, string> = {
  execute: GameplayTags.TRAIT.EXECUTE,
  reflect: GameplayTags.TRAIT.REFLECT,
  lifesteal: GameplayTags.TRAIT.LIFESTEAL,
  mana_thief: GameplayTags.TRAIT.MANA_THIEF,
  shield_master: GameplayTags.TRAIT.SHIELD_MASTER,
  berserker: GameplayTags.TRAIT.BERSERKER,
  cooldown: GameplayTags.TRAIT.COOLDOWN,
};

function assertUniqueEntries<T extends string>(
  entries: T[] | undefined,
  context: string,
): void {
  if (!entries) {
    return;
  }

  if (new Set(entries).size !== entries.length) {
    throw new Error(`${context}: duplicate semantic entries are not allowed`);
  }
}

export function projectAbilityRuntimeSemantics(
  semantics: AbilityRuntimeSemantics,
): string[] {
  const tags = new Set<string>();

  semantics.functions?.forEach((functionSemantic) => {
    tags.add(ABILITY_FUNCTION_TO_TAG[functionSemantic]);
  });

  if (semantics.channel) {
    tags.add(ABILITY_CHANNEL_TO_TAG[semantics.channel]);
  }

  if (semantics.kind) {
    tags.add(ABILITY_KIND_TO_TAG[semantics.kind]);
  }

  semantics.elements?.forEach((element) => {
    tags.add(ELEMENT_TO_RUNTIME_ABILITY_TAG[element]);
  });

  semantics.targets?.forEach((target) => {
    tags.add(ABILITY_TARGET_TO_TAG[target]);
  });

  semantics.traits?.forEach((trait) => {
    tags.add(ABILITY_TRAIT_TO_TAG[trait]);
  });

  return Array.from(tags);
}

export function validateAbilityRuntimeSemantics(
  semantics: AbilityRuntimeSemantics,
  context = 'ability runtime semantics',
): void {
  assertUniqueEntries(semantics.functions, `${context}.functions`);
  assertUniqueEntries(semantics.elements, `${context}.elements`);
  assertUniqueEntries(semantics.targets, `${context}.targets`);
  assertUniqueEntries(semantics.traits, `${context}.traits`);

  projectAbilityRuntimeSemantics(semantics).forEach((tag) => {
    assertRuntimeTag(tag, context);
  });
}