import { DamageParams } from '../core/configs';
import { EventBus } from '../core/EventBus';
import { DamageRequestEvent, EventPriorityLevel } from '../core/events';
import { ValueCalculator } from '../core/ValueCalculator';
import { EffectRegistry } from '../factories/EffectRegistry';
import { EffectContext, GameplayEffect } from './Effect';

/**
 * 伤害原子效果
 * 职责：计算伤害并发布 DamageRequestEvent
 */
export class DamageEffect extends GameplayEffect {
  constructor(private params: DamageParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { caster, target, ability, buff } = context;

    // 使用统一计算器计算基础伤害
    const damage = ValueCalculator.calculate(this.params.value, caster);

    if (damage <= 0) return;

    // 发布伤害请求事件
    EventBus.instance.publish<DamageRequestEvent>({
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability,
      buff, // 传递 buff
      baseDamage: damage,
      finalDamage: damage, // 初始终伤等于基伤，由后续系统修正
    });
  }
}

// 注册到效果注册表
EffectRegistry.getInstance().register(
  'damage',
  (params) => new DamageEffect(params),
);
