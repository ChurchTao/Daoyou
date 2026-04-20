import { ManaBurnParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { EventPriorityLevel, ManaBurnEvent } from '../core/events';
import { ValueCalculator } from '../core/ValueCalculator';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 焚元原子效果
 * 削减目标的 MP
 */
export class ManaBurnEffect extends GameplayEffect {
  constructor(private params: ManaBurnParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { caster, target, ability } = context;

    // 使用统一计算器计算削减量
    const burnAmount = ValueCalculator.calculate(this.params.value, caster);

    if (burnAmount <= 0) return;

    // 执行 MP 削减
    const actualBurned = target.takeMp(burnAmount);

    // 发布焚元事件
    EventBus.instance.publish<ManaBurnEvent>({
      type: 'ManaBurnEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability,
      burnAmount: actualBurned,
    });
  }
}

// 注册
EffectRegistry.getInstance().register(
  'mana_burn',
  (params) => new ManaBurnEffect(params),
);
