import { CreationProductType } from '../types';
import {
  assertCreationTag,
  assertRuntimeTagInNamespaces,
  assertRuntimeTagsInNamespaces,
  GameplayTags,
} from '@shared/engine/shared/tag-domain';
import { isPercentageAttributeType } from '@shared/engine/battle-v5/core/attributeMeta';
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
   * 按结构化输入信号 + 产物类型查询。
   * affix 是否可进入候选池由其自身的 match 元数据决定，而不是外部分类阈值。
   */
  queryBySignals(
    signals: CreationTagSignal[],
    productType?: CreationProductType,
  ): AffixDefinition[] {
    return this.defs.filter((def) => {
      if (productType && !def.applicableTo.includes(productType)) return false;
      return evaluateAffixMatcher(def.match, signals).matched;
    });
  }

  queryByTags(
    tags: string[],
    productType?: CreationProductType,
  ): AffixDefinition[] {
    return this.queryBySignals(
      buildNeutralCreationTagSignals(tags),
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
   * 产物类型边界校验（平衡三角硬规则）。
   * slot 只表达结构位置；产品边界由 applicableTo 显式声明。
   */
  private validateBoundary(def: AffixDefinition): void {
    if (def.applicableTo.length === 0) {
      throw new Error(`affix ${def.id}: applicableTo must not be empty`);
    }

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

      // Gongfa 可监听自身受击/抵抗/闪避等防御事件；否则只能用 global 伪装，
      // 会导致对手事件误触发。边界仍保留在 artifact 禁止主动施法者监听。

      // 规则五：Skill 禁止声明 listenerSpec
      if (
        productType === 'skill' &&
        def.listenerSpec
      ) {
        throw new Error(
          `affix ${def.id}: skill affix must not declare listenerSpec (boundary violation)`,
        );
      }

      // 规则六：Skill 仅允许直接结算型 effect
      if (
        productType === 'skill' &&
        ['attribute_modifier', 'resource_drain', 'percent_damage_modifier'].includes(
          def.effectTemplate.type,
        )
      ) {
        throw new Error(
          `affix ${def.id}: skill affix must not use effect type '${def.effectTemplate.type}' (boundary violation)`,
        );
      }

      // 规则七：Gongfa attribute_modifier 禁止 FIXED modType
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

      // 规则八：Skill apply_buff 内嵌 OWNER_AS_CASTER listener 且 duration > 1 禁止
      // （防止通过长持续 buff 模拟 gongfa 的长期被动系统；DOT/debuff 应用到目标是合法的）
      if (
        productType === 'skill' &&
        def.effectTemplate.type === 'apply_buff'
      ) {
        const buffConfig = def.effectTemplate.params.buffConfig;
        const modifiers = buffConfig.modifiers ?? [];

        for (const modifier of modifiers) {
          const expectedType = isPercentageAttributeType(modifier.attrType)
            ? ModifierType.FIXED
            : ModifierType.ADD;
          if (modifier.type !== expectedType) {
            throw new Error(
              `affix ${def.id}: skill apply_buff modifier '${modifier.attrType}' must use ModifierType.${expectedType.toUpperCase()} (boundary violation)`,
            );
          }
        }

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

    // 规则九：percent_damage_modifier 必须监听 DAMAGE_REQUEST
    if (def.effectTemplate.type === 'percent_damage_modifier') {
      if (def.listenerSpec?.eventType !== GameplayTags.EVENT.DAMAGE_REQUEST) {
        throw new Error(
          `affix ${def.id}: percent_damage_modifier must use listenerSpec.eventType '${GameplayTags.EVENT.DAMAGE_REQUEST}'`,
        );
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
        effect.params.effects?.forEach((child, index) =>
          this.validateEffectTags(child, `${context}.params.effects[${index}]`),
        );
        return;

      case 'consume_status_trigger':
        this.validateBuffMatch(effect.params.match, `${context}.params.match`);
        effect.params.effects.forEach((child, index) =>
          this.validateEffectTags(child, `${context}.params.effects[${index}]`),
        );
        return;

      case 'delayed_effect':
        assertRuntimeTagsInNamespaces(
          effect.params.tags ?? [],
          ['Buff.'],
          `${context}.params.tags`,
        );
        assertRuntimeTagsInNamespaces(
          effect.params.statusTags ?? [],
          ['Status.'],
          `${context}.params.statusTags`,
        );
        effect.params.effects.forEach((child, index) =>
          this.validateEffectTags(child, `${context}.params.effects[${index}]`),
        );
        return;

      case 'buff_layer_modify':
        this.validateBuffMatch(effect.params.match, `${context}.params.match`);
        effect.params.effects?.forEach((child, index) =>
          this.validateEffectTags(child, `${context}.params.effects[${index}]`),
        );
        return;

      case 'ability_transform':
      case 'next_hit_rule':
        assertRuntimeTagsInNamespaces(
          effect.params.appliesToTags ?? [],
          ['Ability.'],
          `${context}.params.appliesToTags`,
        );
        if (effect.type === 'ability_transform' && effect.params.addDispel?.targetTag) {
          assertRuntimeTagInNamespaces(
            effect.params.addDispel.targetTag,
            ['Buff.'],
            `${context}.params.addDispel.targetTag`,
          );
        }
        return;

      case 'status_spread':
        this.validateBuffMatch(effect.params.match, `${context}.params.match`);
        return;

      case 'buff_copy':
        if (effect.params.match) {
          this.validateBuffMatch(effect.params.match, `${context}.params.match`);
        }
        return;

      case 'ability_lock':
        assertRuntimeTagsInNamespaces(
          effect.params.tags ?? [],
          ['Ability.'],
          `${context}.params.tags`,
        );
        return;

      case 'turn_state_counter':
        effect.params.effects.forEach((child, index) =>
          this.validateEffectTags(child, `${context}.params.effects[${index}]`),
        );
        return;

      case 'element_history':
        effect.params.effects.forEach((child, index) =>
          this.validateEffectTags(child, `${context}.params.effects[${index}]`),
        );
        return;

      case 'effect_sequence':
        effect.params.effects.forEach((child, index) =>
          this.validateEffectTags(child, `${context}.params.effects[${index}]`),
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

  private validateBuffMatch(
    match: { id?: string; tags?: string[] },
    context: string,
  ): void {
    assertRuntimeTagsInNamespaces(match.tags ?? [], ['Buff.'], `${context}.tags`);
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
