import { GameplayEffect, EffectContext } from './Effect';
import { AttributeType } from '../core/types';

/**
 * 治疗效果参数
 */
export interface HealEffectParams {
  attribute?: AttributeType; // 依赖属性，不传则使用固定值
  coefficient?: number;      // 属性系数
  baseHeal?: number;         // 基础固定治疗量
}

/**
 * 治疗原子效果
 */
export class HealEffect extends GameplayEffect {
  constructor(private params: HealEffectParams) {
    super();
  }

  execute(context: EffectContext): void {
    const { caster, target } = context;

    let healAmount = this.params.baseHeal ?? 0;

    if (this.params.attribute && this.params.coefficient) {
      const attrValue = caster.attributes.getValue(this.params.attribute);
      healAmount += attrValue * this.params.coefficient;
    }

    // 四舍五入
    healAmount = Math.round(healAmount);

    // 应用治疗
    if (healAmount > 0) {
      target.heal(healAmount);
    }
  }
}
