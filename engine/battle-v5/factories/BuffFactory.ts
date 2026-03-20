import { DataDrivenBuff } from '../buffs/DataDrivenBuff';
import { Buff } from '../buffs/Buff';
import { BuffConfig, EffectConfig } from '../core/configs';
import { DamageEffect } from '../effects/DamageEffect';
import { HealEffect } from '../effects/HealEffect';
import { GameplayEffect } from '../effects/Effect';

/**
 * BUFF 工厂
 * 
 * 职责：
 * - 将强类型的 BuffConfig 转换为 DataDrivenBuff 实例
 * - 装配监听器和效果链
 */
export class BuffFactory {
  /**
   * 根据配置创建 BUFF 实例
   */
  static create(config: BuffConfig): Buff {
    const buff = new DataDrivenBuff(config);

    // 1. 注入 Buff 自身标签
    if (config.tags) {
      buff.tags.addTags(config.tags);
    }

    // 2. 递归装配逻辑监听链
    if (config.listeners) {
      for (const listener of config.listeners) {
        const instantiatedEffects = listener.effects.map(effCfg => this.createEffect(effCfg)).filter(e => e !== null) as GameplayEffect[];
        buff.addInstantiatedListener(listener.eventType, instantiatedEffects);
      }
    }

    return buff;
  }

  /**
   * 创建效果执行器
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
      // 注意：这里需要解决循环依赖问题，ApplyBuffEffect 在 AbilityFactory 中处理
      default:
        return null;
    }
  }
}
