import { NextHitRuleParams } from '../core/configs';
import { addAbilityTransform } from '../core/runtimeState';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';
import { publishMechanicLog } from './advancedEffectUtils';

export class NextHitRuleEffect extends GameplayEffect {
  constructor(private params: NextHitRuleParams) {
    super();
  }

  execute(context: EffectContext): void {
    addAbilityTransform(context.caster, {
      id: `next_hit_rule_${context.ability?.id ?? 'effect'}`,
      remainingTriggers: Math.max(1, this.params.triggers ?? 1),
      appliesToTags: this.params.appliesToTags,
      forceCritical: this.params.forceCritical,
    });
    publishMechanicLog({
      mechanic: 'ability_transform',
      source: context.caster,
      target: context.caster,
      name: '下一击规则',
      value: this.params.triggers ?? 1,
    });
  }
}

EffectRegistry.getInstance().register(
  'next_hit_rule',
  (params) => new NextHitRuleEffect(params),
);
