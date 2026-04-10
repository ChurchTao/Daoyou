import type { ElementType } from '@/types/constants';
import type { EffectConfig, ListenerConfig } from '../../contracts/battle';
import { AttributeType, BuffType } from '../../contracts/battle';
import {
  ELEMENT_TO_RUNTIME_ABILITY_TAG,
  GameplayTags,
  projectAbilityRuntimeSemantics,
} from '@/engine/shared/tag-domain';
import type { CreationProductType, RolledAffix } from '../../types';
import { AffixRegistry, DEFAULT_AFFIX_REGISTRY } from '../../affixes';
import { CreationError } from '../../errors';

type DamageChannel = 'magic' | 'physical' | 'true';

export interface AbilityTagAssemblyInput {
  productType: CreationProductType;
  rolledAffixes?: RolledAffix[]; // 显式传入选中的词缀，用于聚合 runtimeSemantics
  effects?: EffectConfig[];
  listeners?: ListenerConfig[];
  elementBias?: ElementType;
  registry?: AffixRegistry; // 可选：用于查询词缀定义
}

interface AbilityCapabilitySummary {
  hasDamage: boolean;
  hasHeal: boolean;
  hasControl: boolean;
  damageChannel?: DamageChannel;
}

/**
 * AbilityTagAssembler: 声明式聚合产物的战斗标签。
 *
 * 核心逻辑：
 * 1. 优先从选中的词缀定义中投影 `runtimeSemantics`。
 * 2. 将造物时的 `elementBias` 映射为物理层的元素标签。
 * 3. 作为保底，通过分析最终效果生成对应的功能标签。
 */
export function assembleAbilityTags({
  productType,
  rolledAffixes = [],
  effects = [],
  listeners = [],
  elementBias,
  registry = DEFAULT_AFFIX_REGISTRY,
}: AbilityTagAssemblyInput): string[] {
  const tags = new Set<string>();

  // 1. 显式声明聚合
  for (const rolled of rolledAffixes) {
    const definition = registry.queryById(rolled.id);
    if (!definition) {
      continue;
    }

    if (definition.runtimeSemantics) {
      projectAbilityRuntimeSemantics(definition.runtimeSemantics).forEach((tag) =>
        tags.add(tag),
      );
    }
  }

  // 2. 元素主张映射 (Element Bias)
  if (elementBias) {
    tags.add(ELEMENT_TO_RUNTIME_ABILITY_TAG[elementBias]);
  }

  // 3. 产物分类标签 (Outcome Kind)
  if (productType === 'artifact') {
    tags.add(GameplayTags.ABILITY.KIND.ARTIFACT);
  } else if (productType === 'gongfa') {
    tags.add(GameplayTags.ABILITY.KIND.GONGFA);
  }

  // 4. 能力特征分析 (Capability Inference)
  // 仅当 tags 中尚不包含关键功能轴（Damage/Heal/Control）时，尝试通过效果分析进行补全。
  const capabilities = summarizeCapabilities([
    ...effects,
    ...listeners.flatMap((listener) => listener.effects),
  ]);

  if (
    capabilities.hasDamage &&
    !tags.has(GameplayTags.ABILITY.FUNCTION.DAMAGE)
  ) {
    tags.add(GameplayTags.ABILITY.FUNCTION.DAMAGE);
  }

  if (capabilities.hasHeal && !tags.has(GameplayTags.ABILITY.FUNCTION.HEAL)) {
    tags.add(GameplayTags.ABILITY.FUNCTION.HEAL);
  }

  if (
    capabilities.hasControl &&
    !tags.has(GameplayTags.ABILITY.FUNCTION.CONTROL)
  ) {
    tags.add(GameplayTags.ABILITY.FUNCTION.CONTROL);
  }

  // 5. 伤害频道锁定 (Damage Channel)
  // 技能必须明确是法术、物理还是真伤（BEv5 计算公式强依赖此标签）
  if (
    capabilities.damageChannel === 'magic' &&
    !tags.has(GameplayTags.ABILITY.CHANNEL.MAGIC)
  ) {
    tags.add(GameplayTags.ABILITY.CHANNEL.MAGIC);
  } else if (
    capabilities.damageChannel === 'physical' &&
    !tags.has(GameplayTags.ABILITY.CHANNEL.PHYSICAL)
  ) {
    tags.add(GameplayTags.ABILITY.CHANNEL.PHYSICAL);
  } else if (
    capabilities.damageChannel === 'true' &&
    !tags.has(GameplayTags.ABILITY.CHANNEL.TRUE)
  ) {
    tags.add(GameplayTags.ABILITY.CHANNEL.TRUE);
  }

  // 6. 语义约束校验 (Validation)
  if (
    productType === 'skill' &&
    !tags.has(GameplayTags.ABILITY.FUNCTION.DAMAGE) &&
    !tags.has(GameplayTags.ABILITY.FUNCTION.HEAL) &&
    !tags.has(GameplayTags.ABILITY.FUNCTION.CONTROL)
  ) {
    throw new CreationError(
      'Composition',
      'MISSING_CORE_CAPABILITY',
      `技能产物必须声明至少一个核心功能标签（Damage/Heal/Control）。当前标签: ${Array.from(tags).join(', ')}`,
      { productType, tags: Array.from(tags) }
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
          throw new CreationError(
            'Composition',
            'MISSING_DAMAGE_ATTRIBUTE',
            'damage effect is missing an explicit damage attribute'
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
