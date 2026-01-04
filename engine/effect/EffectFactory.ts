import { BaseEffect } from './BaseEffect';
import {
  AddBuffEffect,
  DamageEffect,
  DotDamageEffect,
  HealEffect,
  NoOpEffect,
  StatModifierEffect,
} from './effects';
import {
  EffectType,
  StatModifierType,
  type AddBuffParams,
  type DamageParams,
  type DotDamageParams,
  type EffectConfig,
  type HealParams,
  type StatModifierParams,
} from './types';

/**
 * 效果工厂
 * 将 EffectConfig (JSON) 转换为 BaseEffect 实例
 */
export class EffectFactory {
  /**
   * 根据配置创建效果实例
   * @param config 效果配置
   * @returns 效果实例
   */
  static create(config: EffectConfig): BaseEffect {
    switch (config.type) {
      case EffectType.StatModifier:
        return EffectFactory.createStatModifier(
          config.params as unknown as StatModifierParams,
        );

      case EffectType.Damage:
        return new DamageEffect(config.params as unknown as DamageParams);

      case EffectType.Heal:
        return new HealEffect(config.params as unknown as HealParams);

      case EffectType.AddBuff:
        return new AddBuffEffect(config.params as unknown as AddBuffParams);

      case EffectType.DotDamage:
        return new DotDamageEffect(config.params as unknown as DotDamageParams);

      case EffectType.NoOp:
      default:
        console.warn(
          `[EffectFactory] 未知效果类型: ${config.type}，返回 NoOpEffect`,
        );
        return new NoOpEffect();
    }
  }

  /**
   * 批量创建效果实例
   * @param configs 效果配置数组
   * @returns 效果实例数组
   */
  static createAll(configs: EffectConfig[]): BaseEffect[] {
    return configs.map((config) => EffectFactory.create(config));
  }

  /**
   * 创建属性修正效果
   * 处理 modType 的字符串/枚举转换
   */
  private static createStatModifier(
    params: StatModifierParams,
  ): StatModifierEffect {
    // 如果 modType 是字符串，转换为枚举
    let modType = params.modType;
    if (typeof modType === 'string') {
      modType = StatModifierType[modType as keyof typeof StatModifierType];
    }

    return new StatModifierEffect({
      stat: params.stat,
      modType,
      value: params.value,
    });
  }
}
