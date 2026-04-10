import { AffixCategory, CreationProductType } from '../types';
import {
  assertCreationTag,
  assertRuntimeTag,
  assertRuntimeTagInNamespaces,
  assertRuntimeTagsInNamespaces,
  validateAbilityRuntimeSemantics,
} from '@/engine/shared/tag-domain';
import type { BuffConfig, ConditionConfig, EffectConfig } from '../contracts/battle';
import { AffixDefinition } from './types';
import type { AffixEffectTemplate } from './types';
import { CREATION_AFFIX_POOL_SCORING } from '../config/CreationBalance';

type RuntimeTagBearingEffect = AffixEffectTemplate | EffectConfig;

/**
 * 词缀注册表
 * 存储所有 AffixDefinition，并支持按 tag / 类别 / 产物类型查询
 */
export class AffixRegistry {
  private defs: AffixDefinition[] = [];

  register(defs: AffixDefinition[]): void {
    defs.forEach((def) => this.validateDefinition(def));
    this.defs.push(...defs);
  }

  /**
   * 按 tags + 解锁类别 + 产物类型查询
   * 普通词缀（prefix/suffix）：OR 语义，命中任意 1 个标签即可入池
   * 高阶词缀（resonance+）：至少需要命中 minTagHitsByCategory 数量的标签才可入池
   */
  queryByTags(
    tags: string[],
    unlockedCategories: AffixCategory[],
    productType?: CreationProductType,
  ): AffixDefinition[] {
    const categorySet = new Set<AffixCategory>(unlockedCategories);
    const tagSet = new Set(tags);
    const minHits = CREATION_AFFIX_POOL_SCORING.minTagHitsByCategory;

    return this.defs.filter((def) => {
      if (!categorySet.has(def.category)) return false;
      if (productType && !def.applicableTo.includes(productType)) return false;
      const hitCount = def.tagQuery.filter((t) => tagSet.has(t)).length;
      const required = (minHits as Record<string, number>)[def.category] ?? 1;
      return hitCount >= required;
    });
  }

  queryById(id: string): AffixDefinition | undefined {
    return this.defs.find((d) => d.id === id);
  }

  getAll(): AffixDefinition[] {
    return [...this.defs];
  }

  private validateDefinition(def: AffixDefinition): void {
    def.tagQuery.forEach((tag) =>
      assertCreationTag(tag, `affix ${def.id} tagQuery`),
    );

    if (def.runtimeSemantics) {
      validateAbilityRuntimeSemantics(
        def.runtimeSemantics,
        `affix ${def.id} runtimeSemantics`,
      );
    }

    this.validateEffectTags(def.effectTemplate, `affix ${def.id} effectTemplate`);
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
          assertRuntimeTag(tag, conditionContext);
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
