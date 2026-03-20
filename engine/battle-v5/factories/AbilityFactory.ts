import { Ability } from '../abilities/Ability';
import { DataDrivenActiveSkill } from '../abilities/DataDrivenActiveSkill';
import { DataDrivenPassiveAbility } from '../abilities/DataDrivenPassiveAbility';
import { TargetPolicy } from '../abilities/TargetPolicy';
import { AbilityConfig, EffectConfig } from '../core/configs';
import { AbilityId, AbilityType } from '../core/types';
import { ApplyBuffEffect } from '../effects/ApplyBuffEffect';
import { DamageEffect } from '../effects/DamageEffect';
import { GameplayEffect } from '../effects/Effect';
import { HealEffect } from '../effects/HealEffect';

/**
 * 技能工厂
 *
 * 职责：
 * - 解析强类型的 AbilityConfig
 * - 实例化 DataDrivenActiveSkill 或 DataDrivenPassiveAbility
 * - 递归装配效果链和监听器
 */
export class AbilityFactory {
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
          const effects = listener.effects
            .map((eff) => this.createEffect(eff))
            .filter((e) => e !== null) as GameplayEffect[];
          ability.addInstantiatedListener(listener.eventType, effects);
        });
      }

      return ability;
    }

    throw new Error(`Ability type ${config.type} is not supported.`);
  }

  /**
   * 统一的效果实例化方法 (解决循环依赖)
   */
  static createEffect(cfg: EffectConfig): GameplayEffect | null {
    switch (cfg.type) {
      case 'damage':
        return new DamageEffect({
          attribute: cfg.params.attribute,
          coefficient: cfg.params.coefficient,
          baseDamage: cfg.params.baseValue,
        });
      case 'heal':
        return new HealEffect({
          attribute: cfg.params.attribute,
          coefficient: cfg.params.coefficient,
          baseHeal: cfg.params.baseValue,
        });
      case 'apply_buff':
        if (!cfg.params.buffConfig) return null;
        return new ApplyBuffEffect({
          chance: cfg.params.chance,
          buffConfig: cfg.params.buffConfig,
        });
      default:
        return null;
    }
  }
}
