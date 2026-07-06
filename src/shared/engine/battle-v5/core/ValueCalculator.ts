import { Unit } from '../units/Unit';
import { AttributeType, type DamageComponent } from './types';

/**
 * 可缩放数值配置
 * 支持：基础值 + 属性 * 系数 + 目标最大气血比例
 */
export interface ScalableValue {
  base?: number;
  attribute?: AttributeType;
  coefficient?: number;
  /** 目标最大气血的比例伤害（如 0.08 表示 8% 目标最大气血） */
  targetMaxHpRatio?: number;
  /** 目标最大法力的比例值（如 0.08 表示 8% 目标最大法力） */
  targetMaxMpRatio?: number;
}

export interface ScalableValueResult {
  total: number;
  components: DamageComponent[];
}

/**
 * 数值计算工具类
 */
export class ValueCalculator {
  /**
   * 计算最终数值
   */
  static calculate(value: ScalableValue | number, caster: Unit, target?: Unit): number {
    return this.calculateDetailed(value, caster, target).total;
  }

  static calculateDetailed(
    value: ScalableValue | number,
    caster: Unit,
    target?: Unit,
  ): ScalableValueResult {
    if (typeof value === 'number') {
      return {
        total: value,
        components: [{ kind: 'base', amount: value, mitigation: 'normal' }],
      };
    }

    const components: DamageComponent[] = [];
    let total = 0;
    if (value.base) {
      total += value.base;
      components.push({
        kind: 'base',
        amount: value.base,
        mitigation: 'normal',
      });
    }

    const coefficient = value.coefficient ?? 1.0; // 默认系数为 1.0
    if (value.attribute) {
      const attrValue = caster.attributes.getValue(value.attribute);
      const amount = attrValue * coefficient;
      total += amount;
      components.push({
        kind: `attribute:${value.attribute}`,
        amount,
        mitigation: 'normal',
      });
    }
    if (value.targetMaxHpRatio && target) {
      const amount = target.getMaxHp() * value.targetMaxHpRatio;
      total += amount;
      components.push({
        kind: 'targetMaxHpRatio',
        amount,
        mitigation: 'bypass_defense',
      });
    }
    if (value.targetMaxMpRatio && target) {
      const amount = target.getMaxMp() * value.targetMaxMpRatio;
      total += amount;
      components.push({
        kind: 'targetMaxMpRatio',
        amount,
        mitigation: 'bypass_defense',
      });
    }
    return { total: Math.round(total), components };
  }
}
