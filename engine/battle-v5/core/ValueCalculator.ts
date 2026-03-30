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

    let total = value.base ?? 100; // 默认基础值为 100
    const coefficient = value.coefficient ?? 0.01; // 默认系数为 0.01
    if (value.attribute) {
      const attrValue = source.attributes.getValue(value.attribute);
      total = total * (1 + attrValue * coefficient);
    }
    return Math.round(total);
  }
}
