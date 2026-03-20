import { GameplayEffect, EffectContext } from './Effect';
import { EventBus } from '../core/EventBus';
import { DamageRequestEvent, EventPriorityLevel } from '../core/events';
import { AttributeType } from '../core/types';

/**
 * 伤害效果参数
 */
export interface DamageEffectParams {
  attribute?: AttributeType; // 依赖属性，不传则使用固定值
  coefficient?: number;      // 属性系数
  baseDamage?: number;       // 基础固定伤害
}

/**
 * 伤害原子效果
 * 发布 DamageRequestEvent 接入统一伤害计算管道
 */
export class DamageEffect extends GameplayEffect {
  constructor(private params: DamageEffectParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { caster, target, ability } = context;

    let damage = this.params.baseDamage ?? 0;

    // 如果指定了属性，则根据属性计算额外伤害
    if (this.params.attribute && this.params.coefficient) {
      const attrValue = caster.attributes.getValue(this.params.attribute);
      damage += attrValue * this.params.coefficient;
    }

    // 四舍五入
    damage = Math.round(damage);

    // 发布伤害请求事件
    EventBus.instance.publish<DamageRequestEvent>({
      type: 'DamageRequestEvent',
      priority: EventPriorityLevel.DAMAGE_REQUEST,
      timestamp: Date.now(),
      caster,
      target,
      ability,
      baseDamage: damage,
      finalDamage: damage, // 初始最终伤害等于基础伤害，后续由 DamageSystem 修正
    });
  }
}
