import { HealParams } from '../core/configs';
import { HealEvent } from '../core/events';
import { AttributeType } from '../core/types';
import { ValueCalculator } from '../core/ValueCalculator';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';

/**
 * 治疗原子效果
 */
export class HealEffect extends GameplayEffect {
  constructor(private params: HealParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const { caster, ability, buff } = context;
    const target = this.params.recipient === 'caster' ? caster : context.target;

    // 使用统一计算器计算基础治疗值
    const baseHeal = ValueCalculator.calculate(this.params.value, caster, target);

    if (baseHeal <= 0) return;

    // 治疗增强：施法者的 HEAL_AMPLIFY 属性成比放大治疗量
    const healAmplify =
      caster?.attributes.getValue(AttributeType.HEAL_AMPLIFY) ?? 0;
    const healAmount = Math.round(baseHeal * (1 + healAmplify));

    // 执行治疗逻辑
    const appliedAmount = this.params.target === 'mp'
      ? target.restoreMp(healAmount)
      : target.heal(healAmount);

    if (appliedAmount > 0) {
      context.commit(target, {
        type: 'recovery',
        resource: this.params.target === 'mp' ? 'mp' : 'hp',
        amount: Math.round(appliedAmount),
        after: Math.round(
          this.params.target === 'mp'
            ? target.getCurrentMp()
            : target.getCurrentHp(),
        ),
      });
    }

    if (appliedAmount <= 0) return;

    // 只有实际改变资源时才发布治疗事件；零值事件不能触发“治疗回满”反应。
    context.emit<HealEvent>({
      type: 'HealEvent',
      timestamp: context.owner.runtime.clock.now(),
      caster,
      target,
      ability,
      buff,
      healAmount,
      appliedAmount,
      healType: this.params.target === 'mp' ? 'mp' : 'hp',
    });
  }
}

// 注册
EffectRegistry.getInstance().register(
  'heal',
  (params) => new HealEffect(params),
);
