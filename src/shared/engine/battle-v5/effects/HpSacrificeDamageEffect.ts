import { HpSacrificeDamageParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { DamageRequestEvent } from '../core/events';
import { DamageSource, DamageType } from '../core/types';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';
import { publishMechanicLog } from './advancedEffectUtils';

export class HpSacrificeDamageEffect extends GameplayEffect {
  constructor(private params: HpSacrificeDamageParams) {
    super();
  }

  execute(context: EffectContext): void {
    const floor = this.params.minHpFloor ?? 1;
    const spend = Math.max(
      0,
      Math.min(
        context.caster.getCurrentHp() - floor,
        Math.round(context.caster.getCurrentHp() * this.params.hpRatio),
      ),
    );
    if (spend <= 0) return;

    context.caster.takeDamage(spend);
    publishMechanicLog({
      mechanic: 'hp_sacrifice',
      source: context.caster,
      ability: context.ability,
      sourceBuff: context.buff,
      target: context.caster,
      name: '气血献祭',
      displayName: '气血献祭',
      visibility: 'player',
      value: spend,
    });
    const damage = Math.round(spend * this.params.damagePerHp);
    if (damage <= 0) return;
    EventBus.instance.publish<DamageRequestEvent>({
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: context.caster,
      target: context.target,
      ability: context.ability,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.MAGICAL,
      baseDamage: damage,
      finalDamage: damage,
    });
  }
}

EffectRegistry.getInstance().register(
  'hp_sacrifice_damage',
  (params) => new HpSacrificeDamageEffect(params),
);
