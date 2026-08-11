import { HpSacrificeDamageParams } from '../core/configs';
import { DamageRequestEvent } from '../core/events';
import { DamageSource, DamageType } from '../core/types';
import { EffectRegistry } from '../factories/EffectRegistry';
import { CombatMechanicCodeV3 } from '../v3/mechanics';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';
import { commitMechanicResultV3 } from './advancedEffectUtils';

export class HpSacrificeDamageEffect extends GameplayEffect {
  constructor(private params: HpSacrificeDamageParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
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
    commitMechanicResultV3(context, {
      code: CombatMechanicCodeV3.HP_SACRIFICE,
      target: context.caster,
      visibility: 'player',
      payload: { kind: 'hp_sacrifice', amount: spend },
    });
    const damage = Math.round(spend * this.params.damagePerHp);
    if (damage <= 0) return;
    context.emit<DamageRequestEvent>({
      type: 'DamageRequestEvent',
      timestamp: context.owner.runtime.clock.now(),
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
