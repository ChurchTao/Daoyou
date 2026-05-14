import { PercentDamageModifierParams } from '../core/configs';
import { DamageRequestEvent } from '../core/events';
import { DamageSource } from '../core/types';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 百分比增减伤原子效果
 * 仅写入 DamageRequestEvent 的同乘区桶，不直接乘算伤害。
 */
export class PercentDamageModifierEffect extends GameplayEffect {
  constructor(private params: PercentDamageModifierParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { triggerEvent } = context;
    if (!triggerEvent || triggerEvent.type !== 'DamageRequestEvent') return;

    const damageRequestEvent = triggerEvent as DamageRequestEvent;
    if (damageRequestEvent.damageSource === DamageSource.REFLECT) return;

    const rawValue = Math.max(0, this.params.value);
    const value = this.params.cap
      ? Math.min(rawValue, this.params.cap)
      : rawValue;

    if (this.params.mode === 'increase') {
      damageRequestEvent.damageIncreasePctBucket =
        (damageRequestEvent.damageIncreasePctBucket ?? 0) + value;
      return;
    } else if (this.params.mode === 'reduce') {
      damageRequestEvent.damageReductionPctBucket =
        (damageRequestEvent.damageReductionPctBucket ?? 0) + value;
    }
  }
}

EffectRegistry.getInstance().register(
  'percent_damage_modifier',
  (params) => new PercentDamageModifierEffect(params),
);
