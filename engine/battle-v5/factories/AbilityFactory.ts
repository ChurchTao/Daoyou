import { Ability } from '../abilities/Ability';
import { DataDrivenActiveSkill } from '../abilities/DataDrivenActiveSkill';
import { DataDrivenPassiveAbility } from '../abilities/DataDrivenPassiveAbility';
import { TargetPolicy } from '../abilities/TargetPolicy';
import { GameplayTags } from '../core/GameplayTags';
import { AbilityConfig, EffectConfig, ListenerConfig } from '../core/configs';
import { buildListenerRuntimeConfig } from '../core/listenerExecution';
import { AbilityId, AbilityType, AttributeType, BuffType } from '../core/types';
import { GameplayEffect } from '../effects/Effect';
import { EffectRegistry } from './EffectRegistry';

// 统一加载所有效果以触发它们的自我注册 (Side-effects loading)
import '../effects';

/**
 * 技能工厂
 *
 * 职责：
 * - 解析强类型的 AbilityConfig
 * - 实例化 DataDrivenActiveSkill 或 DataDrivenPassiveAbility
 * - 递归装配效果链和监听器
 */
export class AbilityFactory {
  private static assertListenerContract(listener: ListenerConfig): void {
    if (!listener.scope) {
      throw new Error(
        `Listener ${listener.eventType} is missing required field: scope`,
      );
    }
  }

  /**
   * 根据配置创建技能实例
   */
  static create(config: AbilityConfig): Ability {
    const id = config.slug as AbilityId;
    const name = config.name;
    const abilityTags = this.validateAbilityTags(config);

    // 1. 处理主动技能
    if (config.type === AbilityType.ACTIVE_SKILL) {
      const skill = new DataDrivenActiveSkill(id, name, {
        mpCost: config.mpCost ?? 0,
        hpCost: config.hpCost ?? 0,
        cooldown: config.cooldown ?? 0,
        priority: config.priority ?? 0,
        targetPolicy: config.targetPolicy
          ? new TargetPolicy(config.targetPolicy)
          : TargetPolicy.default(),
      });

          skill.tags.addTags(abilityTags);

      // 装配主动效果链
      if (config.effects) {
        config.effects.forEach((effCfg) => {
          const effect = this.createEffect(effCfg);
          if (effect) skill.addEffect(effect);
        });
      }

      if (config.listeners) {
        config.listeners.forEach((listener) => {
          this.assertListenerContract(listener);
          const effects = listener.effects
            .map((eff) => this.createEffect(eff))
            .filter((e) => e !== null) as GameplayEffect[];
          skill.addInstantiatedListener(
            buildListenerRuntimeConfig(listener),
            effects,
          );
        });
      }

      return skill;
    }

    // 2. 处理被动技能
    if (config.type === AbilityType.PASSIVE_SKILL) {
      const ability = new DataDrivenPassiveAbility(id, name);

      ability.tags.addTags(abilityTags);

      // 装配被动监听器
      if (config.listeners) {
        config.listeners.forEach((listener) => {
          this.assertListenerContract(listener);
          const effects = listener.effects
            .map((eff) => this.createEffect(eff))
            .filter((e) => e !== null) as GameplayEffect[];
          ability.addInstantiatedListener(
            buildListenerRuntimeConfig(listener),
            effects,
          );
        });
      }

      if (config.modifiers) {
        config.modifiers.forEach((modifier) => {
          ability.addModifier(modifier);
        });
      }

      return ability;
    }

    throw new Error(`Ability type ${config.type} is not supported.`);
  }

  /**
   * 统一的效果实例化方法
   */
  static createEffect(cfg: EffectConfig): GameplayEffect | null {
    return EffectRegistry.getInstance().create(cfg);
  }

  private static validateAbilityTags(config: AbilityConfig): string[] {
    const tags = config.tags ?? [];

    if (tags.length === 0) {
      throw new Error(
        `[AbilityFactory] ability ${config.slug} is missing required tags`,
      );
    }

    const tagSet = new Set(tags);
    const capabilities = this.summarizeAbilityCapabilities(config);

    if (
      capabilities.hasDamage &&
      !tagSet.has(GameplayTags.ABILITY.TYPE_DAMAGE)
    ) {
      throw new Error(
        `[AbilityFactory] damage-capable ability ${config.slug} must include ${GameplayTags.ABILITY.TYPE_DAMAGE}`,
      );
    }

    if (capabilities.damageChannel === 'magic') {
      this.assertTag(tagSet, config.slug, GameplayTags.ABILITY.TYPE_MAGIC);
    } else if (capabilities.damageChannel === 'physical') {
      this.assertTag(tagSet, config.slug, GameplayTags.ABILITY.TYPE_PHYSICAL);
    } else if (capabilities.damageChannel === 'true') {
      this.assertTag(
        tagSet,
        config.slug,
        GameplayTags.ABILITY.TYPE_TRUE_DAMAGE,
      );
    }

    if (capabilities.hasHeal) {
      this.assertTag(tagSet, config.slug, GameplayTags.ABILITY.TYPE_HEAL);
    }

    if (capabilities.hasControl) {
      this.assertTag(tagSet, config.slug, GameplayTags.ABILITY.TYPE_CONTROL);
    }

    return tags;
  }

  private static assertTag(
    tagSet: Set<string>,
    abilitySlug: string,
    tag: string,
  ): void {
    if (!tagSet.has(tag)) {
      throw new Error(
        `[AbilityFactory] ability ${abilitySlug} must include ${tag}`,
      );
    }
  }

  private static summarizeAbilityCapabilities(config: AbilityConfig): {
    hasDamage: boolean;
    hasHeal: boolean;
    hasControl: boolean;
    damageChannel?: 'magic' | 'physical' | 'true';
  } {
    const queue: EffectConfig[] = [
      ...(config.effects ?? []),
      ...(config.listeners?.flatMap((listener) => listener.effects) ?? []),
    ];
    const damageChannels = new Set<'magic' | 'physical' | 'true'>();
    let hasDamage = false;
    let hasHeal = false;
    let hasControl = false;

    for (const effect of queue) {
      switch (effect.type) {
        case 'damage': {
          hasDamage = true;

          const attribute = effect.params.value.attribute;
          if (attribute === AttributeType.MAGIC_ATK) {
            damageChannels.add('magic');
          } else if (attribute === AttributeType.ATK) {
            damageChannels.add('physical');
          } else {
            throw new Error(
              `[AbilityFactory] damage effect on ${config.slug} is missing a supported damage attribute`,
            );
          }
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
        `[AbilityFactory] ability ${config.slug} mixes multiple damage channels`,
      );
    }

    return {
      hasDamage,
      hasHeal,
      hasControl,
      damageChannel: damageChannels.values().next().value,
    };
  }
}
