import { GameplayEffect, EffectExecutionContextV3 } from './Effect';
import { ValueCalculator } from '../core/ValueCalculator';
import { EffectRegistry } from '../factories/EffectRegistry';
import { ShieldParams } from '../core/configs';
import { ShieldEvent } from '../core/events';

/**
 * 护盾原子效果
 */
export class ShieldEffect extends GameplayEffect {
  constructor(private params: ShieldParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const { caster, ability } = context;
    const target = this.params.target === 'caster' ? caster : context.target;

    // 使用统一计算器计算护盾值
    const shieldAmount = ValueCalculator.calculate(this.params.value, caster, target);

    if (shieldAmount <= 0) return;

    // 应用护盾
    const before = target.getCurrentShield();
    target.addShield(shieldAmount);
    const applied = target.getCurrentShield() - before;
    if (applied > 0) {
      context.commit(target, {
        type: 'shield',
        amount: Math.round(applied),
        after: Math.round(target.getCurrentShield()),
      });
    }

    // 发布护盾事件
    context.emit<ShieldEvent>({
      type: 'ShieldEvent',
      timestamp: context.owner.runtime.clock.now(),
      caster,
      target,
      ability,
      shieldAmount,
    });
  }
}

// 注册
EffectRegistry.getInstance().register('shield', (params) => new ShieldEffect(params));
