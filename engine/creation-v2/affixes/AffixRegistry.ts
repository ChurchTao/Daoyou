import { AffixCategory, CreationProductType } from '../types';
import {
  assertCreationTag,
  assertRuntimeTagInNamespaces,
  assertRuntimeTagsInNamespaces,
  GameplayTags,
} from '@/engine/shared/tag-domain';
import type { BuffConfig, ConditionConfig, EffectConfig } from '../contracts/battle';
import type { CreationTagSignal } from '../types';
import { buildNeutralCreationTagSignals, evaluateAffixMatcher } from './AffixMatcher';
import {
  AffixDefinition,
  collectAffixMatcherReferencedTags,
} from './types';
import type { AffixEffectTemplate } from './types';

type RuntimeTagBearingEffect = AffixEffectTemplate | EffectConfig;

/**
 * 词缀注册表
 * 存储所有 AffixDefinition，并支持按 matcher 输入 / 类别 / 产物类型查询
 */
export class AffixRegistry {
  private defs: AffixDefinition[] = [];

  register(defs: AffixDefinition[]): void {
    defs.forEach((def) => this.validateDefinition(def));
    this.defs.push(...defs);
  }

  /**
   * 按结构化输入信号 + 解锁类别 + 产物类型查询。
   * affix 是否可进入候选池由其自身的 match 元数据决定，而不是外部分类阈值。
   */
  queryBySignals(
    signals: CreationTagSignal[],
    unlockedCategories: AffixCategory[],
    productType?: CreationProductType,
  ): AffixDefinition[] {
    const categorySet = new Set<AffixCategory>(unlockedCategories);

    return this.defs.filter((def) => {
      if (!categorySet.has(def.category)) return false;
      if (productType && !def.applicableTo.includes(productType)) return false;
      return evaluateAffixMatcher(def.match, signals).matched;
    });
  }

  queryByTags(
    tags: string[],
    unlockedCategories: AffixCategory[],
    productType?: CreationProductType,
  ): AffixDefinition[] {
    return this.queryBySignals(
      buildNeutralCreationTagSignals(tags),
      unlockedCategories,
      productType,
    );
  }

  queryById(id: string): AffixDefinition | undefined {
    return this.defs.find((d) => d.id === id);
  }

  getAll(): AffixDefinition[] {
    return [...this.defs];
  }

  private validateDefinition(def: AffixDefinition): void {
    collectAffixMatcherReferencedTags(def.match).forEach((tag) =>
      assertCreationTag(tag, `affix ${def.id} match`),
    );

    if (def.grantedAbilityTags) {
      this.validateGrantedAbilityTags(
        def.grantedAbilityTags,
        `affix ${def.id} grantedAbilityTags`,
      );
      this.validateGrantedAbilityTagsSchema(def);
    }

    this.validateEffectTags(def.effectTemplate, `affix ${def.id} effectTemplate`);
  }

  private validateGrantedAbilityTags(tags: string[], context: string): void {
    if (new Set(tags).size !== tags.length) {
      throw new Error(`${context}: duplicate tags are not allowed`);
    }

    assertRuntimeTagsInNamespaces(tags, ['Ability.', 'Trait.'], context);
  }

  /**
   * Schema-level cross-field validation for grantedAbilityTags.
   * Rule: Ability.Function.Damage must be paired with exactly one Ability.Channel.* tag.
   */
  private validateGrantedAbilityTagsSchema(def: AffixDefinition): void {
    const tags = def.grantedAbilityTags!;
    const hasDamage = tags.includes(GameplayTags.ABILITY.FUNCTION.DAMAGE);
    const channelPrefix = GameplayTags.ABILITY.CHANNEL.ROOT + '.';
    const channelTags = tags.filter((t) => t.startsWith(channelPrefix));

    if (hasDamage && channelTags.length === 0) {
      throw new Error(
        `affix ${def.id}: grantedAbilityTags declares Ability.Function.Damage but is missing an Ability.Channel.* tag`,
      );
    }

    if (hasDamage && channelTags.length > 1) {
      throw new Error(
        `affix ${def.id}: grantedAbilityTags declares ${channelTags.length} channel tags — only one is allowed per affix`,
      );
    }
  }

  private validateEffectTags(
    effect: RuntimeTagBearingEffect,
    context: string,
  ): void {
    this.validateConditionTags(effect.conditions, `${context}.conditions`);

    switch (effect.type) {
      case 'cooldown_modify':
        if (effect.params.tags) {
          assertRuntimeTagsInNamespaces(
            effect.params.tags,
            ['Ability.', 'Trait.'],
            `${context}.params.tags`,
          );
        }
        return;

      case 'tag_trigger':
        assertRuntimeTagInNamespaces(
          effect.params.triggerTag,
          ['Status.'],
          `${context}.params.triggerTag`,
        );
        return;

      case 'apply_buff':
        this.validateBuffConfigTags(
          effect.params.buffConfig,
          `${context}.params.buffConfig`,
        );
        return;

      case 'buff_immunity':
        assertRuntimeTagsInNamespaces(
          effect.params.tags,
          ['Buff.'],
          `${context}.params.tags`,
        );
        return;

      case 'damage_immunity':
        assertRuntimeTagsInNamespaces(
          effect.params.tags,
          ['Ability.'],
          `${context}.params.tags`,
        );
        return;

      case 'dispel':
        if (effect.params.targetTag) {
          assertRuntimeTagInNamespaces(
            effect.params.targetTag,
            ['Buff.'],
            `${context}.params.targetTag`,
          );
        }
        return;

      default:
        return;
    }
  }

  private validateConditionTags(
    conditions: ConditionConfig[] | undefined,
    context: string,
  ): void {
    conditions?.forEach((condition, index) => {
      const tag = condition.params.tag;
      if (!tag) {
        return;
      }

      const conditionContext = `${context}[${index}].params.tag`;

      switch (condition.type) {
        case 'ability_has_tag':
        case 'ability_has_not_tag':
          assertRuntimeTagInNamespaces(
            tag,
            ['Ability.', 'Trait.'],
            conditionContext,
          );
          return;

        case 'has_tag':
        case 'has_not_tag':
        case 'has_tag_on':
          assertRuntimeTagInNamespaces(
            tag,
            ['Ability.', 'Buff.', 'Event.', 'Scope.', 'Status.', 'Trait.'],
            conditionContext,
          );
          return;

        default:
          return;
      }
    });
  }

  private validateBuffConfigTags(buffConfig: BuffConfig, context: string): void {
    if (buffConfig.tags) {
      assertRuntimeTagsInNamespaces(buffConfig.tags, ['Buff.'], `${context}.tags`);
    }

    if (buffConfig.statusTags) {
      assertRuntimeTagsInNamespaces(
        buffConfig.statusTags,
        ['Status.'],
        `${context}.statusTags`,
      );
    }

    buffConfig.listeners?.forEach((listener, listenerIndex) => {
      listener.effects.forEach((effect, effectIndex) => {
        this.validateEffectTags(
          effect,
          `${context}.listeners[${listenerIndex}].effects[${effectIndex}]`,
        );
      });
    });
  }
}
