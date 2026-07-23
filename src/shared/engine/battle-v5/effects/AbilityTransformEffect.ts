import { AbilityTransformParams } from '../core/configs';
import { addAbilityTransform } from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';
import { publishMechanicLog } from './advancedEffectUtils';

export class AbilityTransformEffect extends GameplayEffect {
  constructor(private params: AbilityTransformParams) {
    super();
  }

  execute(context: EffectContext): void {
    addAbilityTransform(context.caster, {
      id: this.params.id,
      remainingTriggers: Math.max(1, this.params.triggers ?? 1),
      appliesToTags: this.params.appliesToTags,
      trueDamage: this.params.trueDamage,
      addDispel: this.params.addDispel
        ? { type: 'dispel', params: this.params.addDispel }
        : undefined,
      mpCostToHp: this.params.mpCostToHp,
      freeManaCost: this.params.freeManaCost,
      cooldownModify: this.params.cooldownModify,
      forceCritical: this.params.forceCritical,
      bonusDamageMemory: this.params.bonusDamageMemory,
    });
    publishMechanicLog({
      mechanic: 'ability_transform',
      source: context.caster,
      ability: context.ability,
      sourceBuff: context.buff,
      target: context.caster,
      name: this.params.id,
      value: this.params.triggers ?? 1,
    });
  }
}

EffectRegistry.getInstance().register(
  'ability_transform',
  (params) => new AbilityTransformEffect(params),
);
