import type { ResourceScaledDamageParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import type { DamageRequestEvent } from '../core/events';
import { AttributeType, DamageSource, DamageType, type DamageComponent } from '../core/types';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

export class ResourceScaledDamageEffect extends GameplayEffect {
  constructor(private readonly params: ResourceScaledDamageParams) {
    super();
  }

  execute(context: EffectContext): void {
    const current = context.caster.combatResources.getCurrent(this.params.resourceId);
    const points = Math.min(this.params.maxPoints ?? current, current);
    if (points < (this.params.minPoints ?? 0)) return;

    const coefficient = this.params.baseCoefficient + this.params.coefficientPerPoint * points;
    const attribute = this.params.attribute ?? AttributeType.ATK;
    const amount = context.caster.attributes.getValue(attribute) * coefficient;
    if (amount <= 0) return;

    const bypassRatio = Math.max(0, Math.min(1, this.params.bypassDefenseRatio ?? 0));
    const components: DamageComponent[] = [];
    if (bypassRatio < 1) {
      components.push({
        kind: `attribute:${attribute}`,
        amount: amount * (1 - bypassRatio),
        mitigation: 'normal',
        defenseScale: coefficient * (1 - bypassRatio),
      });
    }
    if (bypassRatio > 0) {
      components.push({
        kind: `attribute:${attribute}:bypass`,
        amount: amount * bypassRatio,
        mitigation: 'bypass_defense',
        defenseScale: 0,
      });
    }

    EventBus.instance.publish<DamageRequestEvent>({
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: context.caster,
      target: context.target,
      ability: context.ability,
      damageSource: this.params.damageSource ?? DamageSource.DIRECT,
      damageType: this.params.damageType ?? DamageType.PHYSICAL,
      damageComponents: components,
      baseDamage: amount,
      finalDamage: amount,
      forceCritical: this.params.forceCritical,
    });

    if (this.params.consume) {
      context.caster.combatResources.consume(
        this.params.resourceId,
        this.params.consume === 'all' ? 'all' : this.params.consume,
        { caster: context.caster, ability: context.ability },
      );
    }
  }
}

EffectRegistry.getInstance().register(
  'resource_scaled_damage',
  (params) => new ResourceScaledDamageEffect(params),
);
