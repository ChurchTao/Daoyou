/**
 * ScalableValue → 完整公式文本。
 *
 * 战斗引擎中护盾 / 治疗 / 伤害等常用 `ScalableValue` 结构：
 *   { base?, attribute?, coefficient?, targetMaxHpRatio? }
 *
 * 渲染策略：把基础值、属性成长项、目标最大血量比例三段显式串联成公式，不做运行时近似。
 */
import type { ScalableValue } from '../../core/ValueCalculator';
import { attrLabel } from './attributes';
import { formatAffixNumber, formatAffixPercent } from './format';

/**
 * 格式化一个 ScalableValue，例如：
 *   { base: 38 }                                  → "38"
 *   { base: 38, attribute: 'willpower', coefficient: 0.29 } → "38 + 神识×29%"
 *   { attribute: 'spirit', coefficient: 0.5 }     → "灵力×50%"
 *   { targetMaxHpRatio: 0.08 }                    → "目标气血8%"
 */
export function formatScalableValue(value: ScalableValue): string {
  const parts: string[] = [];

  const hasBase = value.base !== undefined && value.base !== 0;
  if (hasBase) {
    parts.push(formatAffixNumber(value.base ?? 0));
  }

  if (value.attribute && value.coefficient) {
    parts.push(
      `${attrLabel(value.attribute)}×${formatAffixPercent(value.coefficient)}`,
    );
  }

  if (value.targetMaxHpRatio && value.targetMaxHpRatio > 0) {
    parts.push(`目标气血${formatAffixPercent(value.targetMaxHpRatio)}`);
  }

  if (parts.length === 0) {
    // 兜底：base 可能是 0 且无其它项，仍然显式展示 0
    return formatAffixNumber(value.base ?? 0);
  }

  return parts.join(' + ');
}
