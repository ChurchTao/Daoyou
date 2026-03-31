import { GameplayEffect, EffectContext } from './Effect';
import { ValueCalculator } from '../core/ValueCalculator';
import { EffectRegistry } from '../factories/EffectRegistry';
import { ShieldParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { EventPriorityLevel, ShieldEvent } from '../core/events';

/**
 * 护盾原子效果
 */
export class ShieldEffect extends GameplayEffect {
  constructor(private params: ShieldParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { caster, target, ability } = context;

    // 使用统一计算器计算护盾值
    const shieldAmount = ValueCalculator.calculate(this.params.value, caster);

    if (shieldAmount <= 0) return;

    // 应用护盾
    target.addShield(shieldAmount);

    // 发布护盾事件
    EventBus.instance.publish<ShieldEvent>({
      type: 'ShieldEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability,
      shieldAmount,
    });
  }
}

// 注册
EffectRegistry.getInstance().register('shield', (params) => new ShieldEffect(params));
