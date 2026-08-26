import { PercentDamageModifierParams } from '../core/configs';
import { DamageSegmentRequestedEvent } from '../core/events';
import { DamageSource } from '../core/types';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';

/**
 * 百分比增减伤原子效果
 * 仅写入 DamageSegmentRequestedEvent 的同乘区桶，不直接乘算伤害。
 */
export class PercentDamageModifierEffect extends GameplayEffect {
  constructor(private params: PercentDamageModifierParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const { triggerEvent } = context;
    if (!triggerEvent || triggerEvent.type !== 'DamageSegmentRequestedEvent') return;

    const damageRequestEvent = triggerEvent as DamageSegmentRequestedEvent;
    if (damageRequestEvent.calculationMode === 'resolved_final') return;
    if (damageRequestEvent.damageSource === DamageSource.REFLECT) return;
    if (
      this.params.allowedDamageSources &&
      (!damageRequestEvent.damageSource ||
        !this.params.allowedDamageSources.includes(damageRequestEvent.damageSource))
    ) return;
    if (
      damageRequestEvent.damageType &&
      this.params.excludedDamageTypes?.includes(damageRequestEvent.damageType)
    ) return;

    const layerScale = this.params.scaleByBuffLayer
      ? context.buff?.getLayer() ?? 1
      : 1;
    const rawValue = Math.max(0, this.params.value * layerScale);
    const value = this.params.cap
      ? Math.min(rawValue, this.params.cap)
      : rawValue;

    if (this.params.mode === 'increase') {
      damageRequestEvent.damageIncreasePctBucket =
        (damageRequestEvent.damageIncreasePctBucket ?? 0) + value;
    } else if (this.params.mode === 'reduce') {
      damageRequestEvent.damageReductionPctBucket =
        (damageRequestEvent.damageReductionPctBucket ?? 0) + value;
    }

    if (this.params.logTriggerName && value > 0) {
      context.commit(damageRequestEvent.target, {
        type: 'mechanic',
        code: 'conditional_damage_modifier_trigger',
        payload: {
          kind: 'named_trigger',
          label: this.params.logTriggerName,
        },
      });
    }
  }
}

EffectRegistry.getInstance().register(
  'percent_damage_modifier',
  (params) => new PercentDamageModifierEffect(params),
);
