import { Ability } from '../abilities/Ability';
import { DataDrivenActiveSkill } from '../abilities/DataDrivenActiveSkill';
import { DataDrivenPassiveAbility } from '../abilities/DataDrivenPassiveAbility';
import { LayeredDataDrivenActiveSkill } from '../abilities/LayeredDataDrivenActiveSkill';
import { TargetPolicy } from '../abilities/TargetPolicy';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { AbilityConfig, EffectConfig, ListenerConfig } from '../core/configs';
import { buildListenerRuntimeConfig } from '../core/listenerExecution';
import { AbilityId, AbilityType } from '../core/types';
import { GameplayEffect } from '../effects/Effect';
import { EffectRegistry } from './EffectRegistry';
import { analyzeAbilityCapabilities } from './AbilityCapabilityAnalyzer';
import { validateAbilityEffectPlans } from '../core/abilityEffectPlan';

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
    validateAbilityEffectPlans(config);
    const id = config.slug as AbilityId;
    const name = config.name;
    const abilityTags = this.validateAbilityTags(config);

    // 1. 处理主动技能
    if (config.type === AbilityType.ACTIVE_SKILL) {
      if (
        config.completionEffects?.length ||
        config.effectLayers?.length ||
        config.effectPlans?.length
      ) {
        const skill = new LayeredDataDrivenActiveSkill(id, name, {
          description: config.description,
          mpCost: config.mpCost ?? 0,
          hpCost: config.hpCost ?? 0,
          costs: config.costs,
          cooldown: config.cooldown ?? 0,
          priority: config.priority ?? 0,
          targetPolicy: config.targetPolicy
            ? new TargetPolicy(config.targetPolicy)
            : TargetPolicy.default(),
          selectionProfile:
            config.selectionProfile ?? analyzeAbilityCapabilities(config).selectionProfile,
          castConditions: config.castConditions,
          effects: config.effects,
          completionEffects: config.completionEffects,
          castEffects: config.castEffects,
          effectLayers: config.effectLayers,
          effectPlans: config.effectPlans,
        });
        skill.tags.addTags(abilityTags);
        return skill;
      }
      const skill = new DataDrivenActiveSkill(id, name, {
        description: config.description,
        mpCost: config.mpCost ?? 0,
        hpCost: config.hpCost ?? 0,
        costs: config.costs,
        cooldown: config.cooldown ?? 0,
        priority: config.priority ?? 0,
        targetPolicy: config.targetPolicy
          ? new TargetPolicy(config.targetPolicy)
          : TargetPolicy.default(),
        selectionProfile:
          config.selectionProfile ?? analyzeAbilityCapabilities(config).selectionProfile,
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

      if (config.castEffects) {
        config.castEffects.forEach((effCfg) => {
          const effect = this.createEffect(effCfg);
          if (effect) skill.addCastEffect(effect);
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
    const capabilities = analyzeAbilityCapabilities(config);

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

}
