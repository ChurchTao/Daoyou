import { DataDrivenBuff } from '../buffs/DataDrivenBuff';
import { Buff } from '../buffs/Buff';
import { BuffConfig, EffectConfig } from '../core/configs';
import { GameplayEffect } from '../effects/Effect';
import { AbilityFactory } from './AbilityFactory';

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
   * 委托给 AbilityFactory 以保持逻辑统一
   */
  static createEffect(cfg: EffectConfig): GameplayEffect | null {
    return AbilityFactory.createEffect(cfg);
  }
}
