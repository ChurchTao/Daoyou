import { ManaBurnParams } from '../core/configs';
import { ManaBurnEvent } from '../core/events';
import { ValueCalculator } from '../core/ValueCalculator';
import { EffectRegistry } from '../factories/EffectRegistry';
import { CombatMechanicCodeV3 } from '../v3/mechanics';
import { EffectExecutionContextV3, GameplayEffect } from './Effect';

/**
 * 焚元原子效果
 * 削减目标的法力
 */
export class ManaBurnEffect extends GameplayEffect {
  constructor(private params: ManaBurnParams) {
    super();
  }

  execute(context: EffectExecutionContextV3): void {
    const { caster, target, ability } = context;

    // 使用统一计算器计算削减量
    const burnAmount = ValueCalculator.calculate(
      this.params.value,
      caster,
      target,
    );

    if (burnAmount <= 0) return;

    // 执行法力削减
    const actualBurned = target.takeMp(burnAmount);
    if (actualBurned <= 0) return;

    context.commit(target, {
      type: 'mechanic',
      code: CombatMechanicCodeV3.MANA_BURN,
      payload: { kind: 'mana_burn', amount: Math.round(actualBurned) },
    });

    // 发布焚元事件
    context.emit<ManaBurnEvent>({
      type: 'ManaBurnEvent',
      timestamp: context.owner.runtime.clock.now(),
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
