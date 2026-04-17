import { AffixCategory, CreationProductType } from '../types';
import {
  assertCreationTag,
  assertRuntimeTagInNamespaces,
  assertRuntimeTagsInNamespaces,
  GameplayTags,
} from '@/engine/shared/tag-domain';
import type { BuffConfig, ConditionConfig, EffectConfig } from '../contracts/battle';
import { ModifierType } from '../contracts/battle';
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
    this.validateBoundary(def);
  }

  /**
   * 产物类型边界校验（平衡三角硬规则）：
   *
   * 规则一：池与产物类型强绑定
   *   - skill_* 池 → applicableTo 只能含 'skill'
   *   - gongfa_* 池 → applicableTo 只能含 'gongfa'
   *   - artifact_* 池 → applicableTo 只能含 'artifact'
   *
   * 规则二：稀有池只接受 rare/legendary
   *   - skill_rare / gongfa_secret / artifact_treasure → rarity 必须为 rare 或 legendary
   *
   * 规则三：Artifact 禁止 OWNER_AS_CASTER scope
   * 规则四：Gongfa 禁止 OWNER_AS_TARGET scope
   * 规则五：Skill 禁止 attribute_modifier effectType
   * 规则六：Gongfa 禁止 attribute_modifier 使用 FIXED modType
   * 规则七：Skill 禁止 apply_buff 内嵌 listener 且 duration > 1
   */
  private validateBoundary(def: AffixDefinition): void {
    // 规则一：池与产物类型强绑定
    const categoryPrefix = def.category.split('_')[0] as
      | 'skill'
      | 'gongfa'
      | 'artifact';
    for (const productType of def.applicableTo) {
      if (productType !== categoryPrefix) {
        throw new Error(
          `affix ${def.id}: category '${def.category}' is bound to '${categoryPrefix}' but applicableTo contains '${productType}' (pool-product binding violation)`,
        );
      }
    }

    // 规则二：稀有池只接受 rare/legendary
    const RARE_POOLS: AffixCategory[] = [
      'skill_rare',
      'gongfa_secret',
      'artifact_treasure',
    ];
    if (RARE_POOLS.includes(def.category)) {
      if (def.rarity !== 'rare' && def.rarity !== 'legendary') {
        throw new Error(
          `affix ${def.id}: category '${def.category}' requires rarity 'rare' or 'legendary', got '${def.rarity}' (rare pool rarity violation)`,
        );
      }
    }

    // 规则三~七：scope 和 effectType 约束
    for (const productType of def.applicableTo) {
      // 规则三：Artifact 禁止 OWNER_AS_CASTER scope
      if (
        productType === 'artifact' &&
        def.listenerSpec?.scope === GameplayTags.SCOPE.OWNER_AS_CASTER
      ) {
        throw new Error(
          `affix ${def.id}: artifact affix must not use OWNER_AS_CASTER scope (boundary violation)`,
        );
      }

      // 规则四：Gongfa 禁止 OWNER_AS_TARGET scope
      if (
        productType === 'gongfa' &&
        def.listenerSpec?.scope === GameplayTags.SCOPE.OWNER_AS_TARGET
      ) {
        throw new Error(
          `affix ${def.id}: gongfa affix must not use OWNER_AS_TARGET scope (boundary violation)`,
        );
      }

      // 规则五：Skill 禁止 attribute_modifier effectType
      if (
        productType === 'skill' &&
        def.effectTemplate.type === 'attribute_modifier'
      ) {
        throw new Error(
          `affix ${def.id}: skill affix must not use attribute_modifier effect type (boundary violation)`,
        );
      }

      // 规则六：Gongfa attribute_modifier 禁止 FIXED modType
      if (
        productType === 'gongfa' &&
        def.effectTemplate.type === 'attribute_modifier'
      ) {
        const params = def.effectTemplate.params;
        const modifiers =
          'modifiers' in params ? params.modifiers : [params];
        for (const mod of modifiers) {
          if (mod.modType === ModifierType.FIXED) {
            throw new Error(
              `affix ${def.id}: gongfa affix must not use ModifierType.FIXED in attribute_modifier (boundary violation)`,
            );
          }
        }
      }

      // 规则七：Skill apply_buff 内嵌 OWNER_AS_CASTER listener 且 duration > 1 禁止
      // （防止通过长持续 buff 模拟 gongfa 的长期被动系统；DOT/debuff 应用到目标是合法的）
      if (
        productType === 'skill' &&
        def.effectTemplate.type === 'apply_buff'
      ) {
        const buffConfig = def.effectTemplate.params.buffConfig;
        if (
          buffConfig.listeners &&
          buffConfig.listeners.length > 0 &&
          buffConfig.duration !== undefined &&
          buffConfig.duration > 1
        ) {
          const hasCasterPassive = buffConfig.listeners.some(
            (l: { scope?: string }) =>
              l.scope === GameplayTags.SCOPE.OWNER_AS_CASTER,
          );
          if (hasCasterPassive) {
            throw new Error(
              `affix ${def.id}: skill affix must not use apply_buff with OWNER_AS_CASTER listener and duration > 1 (boundary violation)`,
            );
          }
        }
      }
    }
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
