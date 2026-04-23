import type { ElementType } from '@/types/constants';
import {
  ELEMENT_TO_RUNTIME_ABILITY_TAG,
  GameplayTags,
} from '@/engine/shared/tag-domain';
import type { CreationProductType, RolledAffix } from '../../types';
import { CreationError } from '../../errors';



/**
 * AbilityTagAssembler: 直接聚合抽中 affix 的最终能力标签。
 *
 * 核心逻辑：
 * 1. 直接合并 rolledAffixes[].grantedAbilityTags。
 * 2. 将 creation 的结构性补充（product kind / element bias）叠加到结果中。
 * 3. 对技能能力的核心功能轴与伤害频道做一致性校验。
 */
export function assembleAbilityTags({
  productType,
  rolledAffixes = [],
  elementBias,
}: { productType: CreationProductType; rolledAffixes?: RolledAffix[]; elementBias?: ElementType; }): string[] {
  const tags = new Set<string>();

  for (const rolled of rolledAffixes) {
    rolled.grantedAbilityTags?.forEach((tag) => tags.add(tag));
  }

  if (elementBias) {
    tags.add(ELEMENT_TO_RUNTIME_ABILITY_TAG[elementBias]);
  }

  if (productType === 'skill') {
    tags.add(GameplayTags.ABILITY.KIND.SKILL);
  } else if (productType === 'artifact') {
    tags.add(GameplayTags.ABILITY.KIND.ARTIFACT);
  } else if (productType === 'gongfa') {
    tags.add(GameplayTags.ABILITY.KIND.GONGFA);
  }

  const damageChannelTags = [
    GameplayTags.ABILITY.CHANNEL.MAGIC,
    GameplayTags.ABILITY.CHANNEL.PHYSICAL,
    GameplayTags.ABILITY.CHANNEL.TRUE,
  ].filter((tag) => tags.has(tag));

  if (damageChannelTags.length > 1) {
    throw new CreationError(
      'Composition',
      'MIXED_DAMAGE_CHANNELS',
      'ability projection cannot mix multiple damage channels',
      { damageChannels: damageChannelTags },
    );
  }

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
      { productType, tags: Array.from(tags) },
    );
  }

  // Warn about damage-dependent trait tags assembled without a Damage function.
  const damageDependentTraits = [
    GameplayTags.TRAIT.EXECUTE,
    GameplayTags.TRAIT.LIFESTEAL,
  ];
  const orphanTraits = damageDependentTraits.filter(
    (t) => tags.has(t) && !tags.has(GameplayTags.ABILITY.FUNCTION.DAMAGE),
  );
  if (orphanTraits.length > 0) {
    console.warn(
      `[AbilityTagAssembler] ${productType} 产物包含依赖 Damage 的 trait 标签但缺少 Ability.Function.Damage:`,
      orphanTraits,
      '当前所有标签:',
      Array.from(tags),
    );
  }

  return Array.from(tags);
}
