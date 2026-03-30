import { Unit } from '../units/Unit';
import { AttributeType } from './types';

/**
 * 可缩放数值配置
 * 支持：基础值 + 属性 * 系数
 */
export interface ScalableValue {
  base?: number;
  attribute?: AttributeType;
  coefficient?: number;
}

/**
 * 数值计算工具类
 */
export class ValueCalculator {
  /**
   * 计算最终数值
   */
  static calculate(value: ScalableValue | number, caster: Unit): number {

    if (typeof value === 'number') {
      return value;
    }

    let total = value.base ?? 0; // 默认基础值为 0
    const coefficient = value.coefficient ?? 1.0; // 默认系数为 1.0
    if (value.attribute) {
      const attrValue = caster.attributes.getValue(value.attribute);
      total = total + attrValue * coefficient;
    }
    return Math.round(total);
  }
}
