import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type {
  AbilityConfig,
  AbilitySelectionProfile,
  EffectConfig,
} from '../core/configs';
import { AttributeType, BuffType, DamageType } from '../core/types';

export type AbilityDamageChannel = 'magic' | 'physical' | 'true';

export interface AbilityCapabilitySummary {
  hasDamage: boolean;
  hasHeal: boolean;
  hasControl: boolean;
  hasBuff: boolean;
  damageChannels: Set<AbilityDamageChannel>;
  selectionProfile?: AbilitySelectionProfile;
}

function channelForDamage(effect: Extract<EffectConfig, { type: 'damage' }>) {
  if (effect.params.damageType === DamageType.TRUE) return 'true' as const;
  if (effect.params.damageType === DamageType.MAGICAL) return 'magic' as const;
  if (effect.params.damageType === DamageType.PHYSICAL) return 'physical' as const;

  const attribute = effect.params.value.attribute;
  if (attribute === AttributeType.MAGIC_ATK || attribute === AttributeType.MAGIC_DEF) {
    return 'magic' as const;
  }
  if (attribute === AttributeType.ATK || attribute === AttributeType.DEF) {
    return 'physical' as const;
  }
  throw new Error('damage effect is missing a supported damage type');
}

function nestedEffects(effect: EffectConfig): EffectConfig[] {
  const params = effect.params as {
    effects?: EffectConfig[];
    fallbackEffects?: EffectConfig[];
    cancelEffects?: EffectConfig[];
  };
  return [
    ...(params.effects ?? []),
    ...(params.fallbackEffects ?? []),
    ...(params.cancelEffects ?? []),
  ];
}

export function analyzeAbilityCapabilities(
  config: Pick<
    AbilityConfig,
    'effects' | 'completionEffects' | 'effectLayers' | 'castEffects' | 'listeners' | 'tags' | 'slug'
  >,
): AbilityCapabilitySummary {
  const queue: EffectConfig[] = [
    ...(config.effects ?? []),
    ...(config.completionEffects ?? []),
    ...(config.effectLayers?.flatMap((layer) => [
      ...(layer.effects ?? []),
      ...(layer.completionEffects ?? []),
    ]) ?? []),
    ...(config.castEffects ?? []),
    ...(config.listeners?.flatMap((listener) => listener.effects) ?? []),
  ];
  const damageChannels = new Set<AbilityDamageChannel>();
  const intents = new Set<
    NonNullable<AbilitySelectionProfile['intents']>[number]
  >();
  let hasDamage = false;
  let hasHeal = false;
  let hasControl = false;
  let hasBuff = false;

  for (let index = 0; index < queue.length; index += 1) {
    const effect = queue[index];
    queue.push(...nestedEffects(effect));
    switch (effect.type) {
      case 'damage':
        hasDamage = true;
        damageChannels.add(channelForDamage(effect));
        intents.add('damage');
        break;
      case 'resource_scaled_damage':
        hasDamage = true;
        damageChannels.add(
          effect.params.damageType === DamageType.TRUE
            ? 'true'
            : effect.params.damageType === DamageType.MAGICAL
              ? 'magic'
              : 'physical',
        );
        intents.add('damage');
        break;
      case 'tag_trigger':
        if (!effect.params.effects?.length) {
          hasDamage = true;
          damageChannels.add('magic');
        }
        intents.add('damage');
        break;
      case 'damage_memory':
        if (effect.params.mode !== 'release') break;
        if (effect.params.releaseAs === 'heal') {
          hasHeal = true;
          intents.add('heal_hp');
        } else if (effect.params.releaseAs === 'shield') {
          intents.add('defensive');
        } else {
          hasDamage = true;
          damageChannels.add(
            effect.params.releaseAs === 'counter' ||
              effect.params.releaseAs === 'follow_up'
              ? 'physical'
              : 'true',
          );
          intents.add('damage');
        }
        break;
      case 'hp_sacrifice_damage':
        hasDamage = true;
        damageChannels.add('magic');
        intents.add('damage');
        break;
      case 'heal':
        hasHeal = true;
        intents.add(effect.params.target === 'mp' ? 'restore_mp' : 'heal_hp');
        break;
      case 'apply_buff':
        if (effect.params.buffConfig.type === BuffType.CONTROL) {
          hasControl = true;
          intents.add('control');
        } else {
          hasBuff = true;
          intents.add('buff');
        }
        break;
      case 'ability_lock':
        hasControl = true;
        intents.add('control');
        break;
      case 'shield':
      case 'magic_shield':
      case 'death_prevent':
      case 'damage_defer':
        intents.add('defensive');
        break;
      case 'ability_transform':
      case 'next_hit_rule':
      case 'buff_copy':
        hasBuff = true;
        intents.add('buff');
        break;
      default:
        break;
    }
  }

  if (damageChannels.has('magic') && damageChannels.has('physical')) {
    throw new Error(
      `[AbilityFactory] ability ${config.slug ?? '<anonymous>'} mixes multiple damage channels`,
    );
  }
  if (intents.size === 0) {
    if (config.tags?.includes(GameplayTags.ABILITY.FUNCTION.HEAL)) intents.add('heal_hp');
    if (config.tags?.includes(GameplayTags.ABILITY.FUNCTION.CONTROL)) intents.add('control');
    if (config.tags?.includes(GameplayTags.ABILITY.FUNCTION.DAMAGE)) intents.add('damage');
    if (config.tags?.includes(GameplayTags.ABILITY.FUNCTION.BUFF)) intents.add('buff');
  }

  return {
    hasDamage,
    hasHeal,
    hasControl,
    hasBuff,
    damageChannels,
    selectionProfile: intents.size ? { intents: Array.from(intents) } : undefined,
  };
}
