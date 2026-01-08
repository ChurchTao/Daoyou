import { BaseEffect } from './BaseEffect';
import {
  AddBuffEffect,
  CriticalEffect,
  DamageEffect,
  DamageReductionEffect,
  DotDamageEffect,
  HealEffect,
  LifeStealEffect,
  ModifyHitRateEffect,
  NoOpEffect,
  ReflectDamageEffect,
  ShieldEffect,
  StatModifierEffect,
} from './effects';
import { CounterAttackEffect } from './effects/CounterAttackEffect';
import { DispelEffect } from './effects/DispelEffect';
import { ElementDamageBonusEffect } from './effects/ElementDamageBonusEffect';
import { ExecuteDamageEffect } from './effects/ExecuteDamageEffect';
import { HealAmplifyEffect } from './effects/HealAmplifyEffect';
import { ManaDrainEffect } from './effects/ManaDrainEffect';
import { ManaRegenEffect } from './effects/ManaRegenEffect';
import type { ModifyHitRateParams } from './effects/ModifyHitRateEffect';
import {
  EffectType,
  StatModifierType,
  type AddBuffParams,
  type CounterAttackParams,
  type CriticalParams,
  type DamageParams,
  type DamageReductionParams,
  type DispelParams,
  type DotDamageParams,
  type EffectConfig,
  type ElementDamageBonusParams,
  type ExecuteDamageParams,
  type HealAmplifyParams,
  type HealParams,
  type LifeStealParams,
  type ManaDrainParams,
  type ManaRegenParams,
  type ReflectDamageParams,
  type ShieldParams,
  type StatModifierParams,
  type TrueDamageParams,
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

      case EffectType.ReflectDamage:
        return new ReflectDamageEffect(
          config.params as unknown as ReflectDamageParams,
        );

      case EffectType.LifeSteal:
        return new LifeStealEffect(config.params as unknown as LifeStealParams);

      case EffectType.Shield:
        return new ShieldEffect(config.params as unknown as ShieldParams);

      case EffectType.ModifyHitRate:
        return new ModifyHitRateEffect(
          config.params as unknown as ModifyHitRateParams,
        );

      case EffectType.Critical:
        return new CriticalEffect(config.params as unknown as CriticalParams);

      case EffectType.DamageReduction:
        return new DamageReductionEffect(
          config.params as unknown as DamageReductionParams,
        );

      // === P0 新效果类型 ===
      case EffectType.ElementDamageBonus:
        return new ElementDamageBonusEffect(
          config.params as unknown as ElementDamageBonusParams,
        );

      case EffectType.HealAmplify:
        return new HealAmplifyEffect(
          config.params as unknown as HealAmplifyParams,
        );

      case EffectType.ManaRegen:
        return new ManaRegenEffect(config.params as unknown as ManaRegenParams);

      case EffectType.ManaDrain:
        return new ManaDrainEffect(config.params as unknown as ManaDrainParams);

      case EffectType.Dispel:
        return new DispelEffect(config.params as unknown as DispelParams);

      // === P1 新效果类型 ===
      case EffectType.ExecuteDamage:
        return new ExecuteDamageEffect(
          config.params as unknown as ExecuteDamageParams,
        );

      case EffectType.TrueDamage: {
        // 【重构】TrueDamage 映射为 DamageEffect，设置无视防御和护盾
        const trueParams = config.params as unknown as TrueDamageParams;
        return new DamageEffect({
          multiplier: 0,
          flatDamage: trueParams.baseDamage,
          ignoreDefense: trueParams.ignoreReduction ?? true,
          ignoreShield: trueParams.ignoreShield ?? true,
          canCrit: false,
        });
      }

      case EffectType.CounterAttack:
        return new CounterAttackEffect(
          config.params as unknown as CounterAttackParams,
        );

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
