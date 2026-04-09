import type { ElementType } from '@/types/constants';
import { ELEMENT_TO_ABILITY_TAG } from '../../config/CreationMappings';
import type { EffectConfig, ListenerConfig } from '../../contracts/battle';
import { AttributeType, BuffType } from '../../contracts/battle';
import { CreationTags } from '../../core/GameplayTags';
import type { CreationProductType } from '../../types';

type DamageChannel = 'magic' | 'physical' | 'true';

export interface AbilityTagAssemblyInput {
  productType: CreationProductType;
  effects?: EffectConfig[];
  listeners?: ListenerConfig[];
  elementBias?: ElementType;
}

interface AbilityCapabilitySummary {
  hasDamage: boolean;
  hasHeal: boolean;
  hasControl: boolean;
  damageChannel?: DamageChannel;
}

export function assembleAbilityTags({
  productType,
  effects = [],
  listeners = [],
  elementBias,
}: AbilityTagAssemblyInput): string[] {
  const tags = new Set<string>();
  const capabilities = summarizeCapabilities([
    ...effects,
    ...listeners.flatMap((listener) => listener.effects),
  ]);

  if (productType === 'artifact') {
    tags.add(CreationTags.BATTLE.ABILITY_KIND_ARTIFACT);
  }

  if (productType === 'gongfa') {
    tags.add(CreationTags.BATTLE.ABILITY_KIND_GONGFA);
  }

  if (capabilities.hasDamage) {
    tags.add(CreationTags.BATTLE.ABILITY_TYPE_DAMAGE);
  }

  if (capabilities.hasHeal) {
    tags.add(CreationTags.BATTLE.ABILITY_TYPE_HEAL);
  }

  if (capabilities.hasControl) {
    tags.add(CreationTags.BATTLE.ABILITY_TYPE_CONTROL);
  }

  if (capabilities.damageChannel === 'magic') {
    tags.add(CreationTags.BATTLE.ABILITY_TYPE_MAGIC);
  } else if (capabilities.damageChannel === 'physical') {
    tags.add(CreationTags.BATTLE.ABILITY_TYPE_PHYSICAL);
  } else if (capabilities.damageChannel === 'true') {
    tags.add(CreationTags.BATTLE.ABILITY_TYPE_TRUE_DAMAGE);
  }

  if (elementBias) {
    tags.add(ELEMENT_TO_ABILITY_TAG[elementBias]);
  }

  if (
    productType === 'skill' &&
    !capabilities.hasDamage &&
    !capabilities.hasHeal &&
    !capabilities.hasControl
  ) {
    throw new Error(
      '[AbilityTagAssembler] skill projection must declare at least one primary ability role',
    );
  }

  if (capabilities.hasDamage && !capabilities.damageChannel) {
    throw new Error(
      '[AbilityTagAssembler] damage-capable ability projection must declare exactly one damage channel',
    );
  }

  return Array.from(tags);
}

function summarizeCapabilities(
  effects: EffectConfig[],
): AbilityCapabilitySummary {
  const damageChannels = new Set<DamageChannel>();
  let hasDamage = false;
  let hasHeal = false;
  let hasControl = false;

  for (const effect of effects) {
    switch (effect.type) {
      case 'damage': {
        hasDamage = true;
        const channel = resolveDamageChannel(effect.params.value.attribute);
        if (!channel) {
          throw new Error(
            '[AbilityTagAssembler] damage effect is missing an explicit damage attribute',
          );
        }
        damageChannels.add(channel);
        break;
      }

      case 'tag_trigger':
        hasDamage = true;
        damageChannels.add('magic');
        break;

      case 'heal':
        hasHeal = true;
        break;

      case 'apply_buff':
        if (effect.params.buffConfig.type === BuffType.CONTROL) {
          hasControl = true;
        }
        break;

      default:
        break;
    }
  }

  if (damageChannels.size > 1) {
    throw new Error(
      '[AbilityTagAssembler] mixed damage channels are not supported within one ability projection',
    );
  }

  return {
    hasDamage,
    hasHeal,
    hasControl,
    damageChannel: damageChannels.values().next().value,
  };
}

function resolveDamageChannel(
  attribute?: AttributeType,
): DamageChannel | undefined {
  switch (attribute) {
    case AttributeType.MAGIC_ATK:
    case AttributeType.SPIRIT:
      return 'magic';
    case AttributeType.ATK:
      return 'physical';
    default:
      return undefined;
  }
}