import { GameplayEffect, EffectContext } from './Effect';
import { ValueCalculator } from '../core/ValueCalculator';
import { EffectRegistry } from '../factories/EffectRegistry';
import { HealParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { EventPriorityLevel, HealEvent } from '../core/events';
import { AttributeType } from '../core/types';

/**
 * 治疗原子效果
 */
export class HealEffect extends GameplayEffect {
  constructor(private params: HealParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { caster, target, ability, buff } = context;

    // 使用统一计算器计算基础治疗值
    const baseHeal = ValueCalculator.calculate(this.params.value, caster);

    if (baseHeal <= 0) return;

    // 治疗增强：施法者的 HEAL_AMPLIFY 属性成比放大治疗量
    const healAmplify = caster?.attributes.getValue(AttributeType.HEAL_AMPLIFY) ?? 0;
    const healAmount = Math.round(baseHeal * (1 + healAmplify));

    // 执行治疗逻辑
    target.heal(healAmount);

    // 发布治疗事件用于日志和触发
    EventBus.instance.publish<HealEvent>({
      type: 'HealEvent',
      priority: EventPriorityLevel.POST_SETTLE,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      buff,
      healAmount,
    });
  }
}

// 注册
EffectRegistry.getInstance().register('heal', (params) => new HealEffect(params));
