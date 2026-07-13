import { Ability } from '../abilities/Ability';
import { DataDrivenActiveSkill } from '../abilities/DataDrivenActiveSkill';
import { DataDrivenPassiveAbility } from '../abilities/DataDrivenPassiveAbility';
import { TargetPolicy } from '../abilities/TargetPolicy';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  AbilityConfig,
  AbilitySelectionProfile,
  EffectConfig,
  ListenerConfig,
} from '../core/configs';
import { buildListenerRuntimeConfig } from '../core/listenerExecution';
import { AbilityId, AbilityType, AttributeType, BuffType, DamageType } from '../core/types';
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
        selectionProfile:
          config.selectionProfile ?? this.inferSelectionProfile(config),
        castConditions: config.castConditions,
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
            .map((eff) => {
              const effect = this.createEffect(eff);
              return effect ? { effect, globalUnique: eff.globalUnique } : null;
            })
            .filter((e) => e !== null);
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
            .map((eff) => {
              const effect = this.createEffect(eff);
              return effect ? { effect, globalUnique: eff.globalUnique } : null;
            })
            .filter((e) => e !== null);
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
      !tagSet.has(GameplayTags.ABILITY.FUNCTION.DAMAGE)
    ) {
      throw new Error(
        `[AbilityFactory] damage-capable ability ${config.slug} must include ${GameplayTags.ABILITY.FUNCTION.DAMAGE}`,
      );
    }

    if (capabilities.damageChannels.has('magic')) {
      this.assertTag(tagSet, config.slug, GameplayTags.ABILITY.CHANNEL.MAGIC);
    }
    if (capabilities.damageChannels.has('physical')) {
      this.assertTag(
        tagSet,
        config.slug,
        GameplayTags.ABILITY.CHANNEL.PHYSICAL,
      );
    }
    if (capabilities.damageChannels.has('true')) {
      this.assertTag(
        tagSet,
        config.slug,
        GameplayTags.ABILITY.CHANNEL.TRUE,
      );
    }

    if (capabilities.hasHeal) {
      this.assertTag(tagSet, config.slug, GameplayTags.ABILITY.FUNCTION.HEAL);
    }

    if (capabilities.hasControl) {
      this.assertTag(
        tagSet,
        config.slug,
        GameplayTags.ABILITY.FUNCTION.CONTROL,
      );
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
    damageChannels: Set<'magic' | 'physical' | 'true'>;
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
      if ('effects' in effect.params && Array.isArray(effect.params.effects)) {
        queue.push(...effect.params.effects);
      }
      switch (effect.type) {
        case 'damage': {
          hasDamage = true;

          if (effect.params.damageType === DamageType.TRUE) {
            damageChannels.add('true');
            break;
          }

          const attribute = effect.params.value.attribute;
          if (
            attribute === AttributeType.MAGIC_ATK ||
            attribute === AttributeType.MAGIC_DEF
          ) {
            damageChannels.add('magic');
          } else if (
            attribute === AttributeType.ATK ||
            attribute === AttributeType.DEF
          ) {
            damageChannels.add('physical');
          } else {
            throw new Error(
              `[AbilityFactory] damage effect on ${config.slug} is missing a supported damage attribute`,
            );
          }
          break;
        }

        case 'tag_trigger':
          if (effect.params.effects && effect.params.effects.length > 0) {
            queue.push(...effect.params.effects);
          } else {
            hasDamage = true;
            damageChannels.add('magic');
          }
          break;

        case 'damage_memory':
          if (effect.type === 'damage_memory' && effect.params.mode !== 'release') {
            break;
          }
          if (effect.params.releaseAs === 'heal') {
            hasHeal = true;
          } else if (effect.params.releaseAs !== 'shield') {
            hasDamage = true;
            damageChannels.add('true');
          }
          break;

        case 'hp_sacrifice_damage':
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

    if (damageChannels.has('magic') && damageChannels.has('physical')) {
      throw new Error(
        `[AbilityFactory] ability ${config.slug} mixes multiple damage channels`,
      );
    }

    return {
      hasDamage,
      hasHeal,
      hasControl,
      damageChannels,
    };
  }

  private static inferSelectionProfile(
    config: AbilityConfig,
  ): AbilitySelectionProfile | undefined {
    const intents = new Set<NonNullable<AbilitySelectionProfile['intents']>[number]>();
    const effects = [
      ...(config.effects ?? []),
      ...(config.listeners?.flatMap((listener) => listener.effects) ?? []),
    ];

    for (const effect of effects) {
      if ('effects' in effect.params && Array.isArray(effect.params.effects)) {
        effects.push(...effect.params.effects);
      }
      if (effect.type === 'apply_buff') {
        effects.push(
          ...(effect.params.buffConfig.listeners?.flatMap((listener) => listener.effects) ?? []),
        );
      }

      switch (effect.type) {
        case 'damage':
        case 'tag_trigger':
        case 'hp_sacrifice_damage':
          intents.add('damage');
          break;
        case 'damage_memory':
          if (effect.params.mode === 'release') {
            if (effect.params.releaseAs === 'heal') {
              intents.add('heal_hp');
            } else if (effect.params.releaseAs === 'shield') {
              intents.add('defensive');
            } else {
              intents.add('damage');
            }
          }
          break;
        case 'heal':
          intents.add(effect.params.target === 'mp' ? 'restore_mp' : 'heal_hp');
          break;
        case 'shield':
        case 'magic_shield':
        case 'death_prevent':
        case 'damage_defer':
          intents.add('defensive');
          break;
        case 'ability_lock':
          intents.add('control');
          break;
        case 'ability_transform':
        case 'next_hit_rule':
        case 'buff_copy':
          intents.add('buff');
          break;
        case 'apply_buff':
          intents.add(
            effect.params.buffConfig.type === BuffType.CONTROL
              ? 'control'
              : 'buff',
          );
          break;
        default:
          break;
      }
    }

    if (intents.size === 0) {
      if (config.tags?.includes(GameplayTags.ABILITY.FUNCTION.HEAL)) {
        intents.add('heal_hp');
      }
      if (config.tags?.includes(GameplayTags.ABILITY.FUNCTION.CONTROL)) {
        intents.add('control');
      }
      if (config.tags?.includes(GameplayTags.ABILITY.FUNCTION.DAMAGE)) {
        intents.add('damage');
      }
      if (config.tags?.includes(GameplayTags.ABILITY.FUNCTION.BUFF)) {
        intents.add('buff');
      }
    }

    return intents.size > 0 ? { intents: Array.from(intents) } : undefined;
  }
}
