import { checkConditions } from '../core/conditionEvaluator';
import { ConditionalEffectTriggerParams } from '../core/configs';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 条件触发器原子效果
 * 满足条件并通过概率后，触发内嵌效果链。
 */
export class ConditionalEffectTriggerEffect extends GameplayEffect {
  private effects: GameplayEffect[];

  constructor(private params: ConditionalEffectTriggerParams) {
    super();
    this.effects = params.effects
      .map((config) => EffectRegistry.getInstance().create(config))
      .filter((effect): effect is GameplayEffect => effect !== null);
  }

  execute(context: EffectContext): void {
    const conditions = this.params.conditions ?? [];
    if (conditions.length > 0 && !checkConditions(context, conditions)) return;

    const chance = this.params.chance ?? 1;
    if (Math.random() >= chance) return;

    this.effects.forEach((effect) => effect.execute(context));
  }
}

EffectRegistry.getInstance().register(
  'conditional_effect_trigger',
  (params) => new ConditionalEffectTriggerEffect(params),
);
