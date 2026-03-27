import { Ability } from '../abilities/Ability';
import { DataDrivenActiveSkill } from '../abilities/DataDrivenActiveSkill';
import { DataDrivenPassiveAbility } from '../abilities/DataDrivenPassiveAbility';
import { TargetPolicy } from '../abilities/TargetPolicy';
import { AbilityConfig, EffectConfig, ListenerConfig } from '../core/configs';
import { buildListenerRuntimeConfig } from '../core/listenerExecution';
import { AbilityId, AbilityType } from '../core/types';
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

      if (config.tags) skill.tags.addTags(config.tags);

      // 装配主动效果链
      if (config.effects) {
        config.effects.forEach((effCfg) => {
          const effect = this.createEffect(effCfg);
          if (effect) skill.addEffect(effect);
        });
      }

      return skill;
    }

    // 2. 处理被动技能
    if (config.type === AbilityType.PASSIVE_SKILL) {
      const ability = new DataDrivenPassiveAbility(id, name);

      if (config.tags) ability.tags.addTags(config.tags);

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
}
