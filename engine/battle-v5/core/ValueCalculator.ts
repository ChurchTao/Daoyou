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
  static calculate(value: ScalableValue | number, source: Unit): number {
    if (typeof value === 'number') {
      return value;
    }

    let total = value.base ?? 0;
    if (value.attribute && value.coefficient) {
      const attrValue = source.attributes.getValue(value.attribute);
      total += attrValue * value.coefficient;
    }

    return Math.round(total);
  }
}
