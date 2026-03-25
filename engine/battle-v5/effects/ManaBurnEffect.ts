import { GameplayEffect, EffectContext } from './Effect';
import { ValueCalculator } from '../core/ValueCalculator';
import { EffectRegistry } from '../factories/EffectRegistry';
import { ManaBurnParams } from '../core/configs';

/**
 * 焚元原子效果
 * 削减目标的 MP
 */
export class ManaBurnEffect extends GameplayEffect {
  constructor(private params: ManaBurnParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { caster, target } = context;

    // 使用统一计算器计算削减量
    const burnAmount = ValueCalculator.calculate(this.params.value, caster);

    if (burnAmount <= 0) return;

    // 执行 MP 削减
    target.consumeMp(burnAmount);
  }
}

// 注册
EffectRegistry.getInstance().register('mana_burn', (params) => new ManaBurnEffect(params));
