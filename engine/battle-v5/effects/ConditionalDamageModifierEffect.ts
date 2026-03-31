import { checkConditions } from '../core/conditionEvaluator';
import { ConditionalDamageModifierParams } from '../core/configs';
import { DamageRequestEvent } from '../core/events';
import { DamageSource } from '../core/types';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 条件增减伤原子效果
 * 满足条件时写入同乘区桶，可统一表达低血/高血/标签增伤。
 */
export class ConditionalDamageModifierEffect extends GameplayEffect {
  constructor(private params: ConditionalDamageModifierParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { triggerEvent } = context;
    if (!triggerEvent || triggerEvent.type !== 'DamageRequestEvent') return;

    const damageRequestEvent = triggerEvent as DamageRequestEvent;
    if (damageRequestEvent.damageSource === DamageSource.REFLECT) return;

    const conditions = this.params.conditions ?? [];
    if (conditions.length > 0 && !checkConditions(context, conditions)) return;

    const mode = this.params.mode ?? 'increase';
    const rawValue = Math.max(0, this.params.value);
    const value = this.params.cap ? Math.min(rawValue, this.params.cap) : rawValue;

    if (mode === 'increase') {
      damageRequestEvent.damageIncreasePctBucket =
        (damageRequestEvent.damageIncreasePctBucket ?? 0) + value;
      return;
    }

    damageRequestEvent.damageReductionPctBucket =
      (damageRequestEvent.damageReductionPctBucket ?? 0) + value;
  }
}

EffectRegistry.getInstance().register(
  'conditional_damage_modifier',
  (params) => new ConditionalDamageModifierEffect(params),
);
