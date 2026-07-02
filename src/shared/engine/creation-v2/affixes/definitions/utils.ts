import { ScalableParam } from "../types";

const QUALITY_COEFFICIENT_STEP = 0.125;
const DAMAGE_COEFFICIENT_BASE_FACTOR = 1.12;
const DAMAGE_QUALITY_COEFFICIENT_STEP = 0.055;

export function qualityScaledCoefficient(base: number): ScalableParam {
  return {
    base,
    scale: 'quality',
    coefficient: base * QUALITY_COEFFICIENT_STEP,
  };
}

/**
 * 主动伤害技能专用的品质系数曲线。
 * 伤害词条仍随品质成长，但高品质不再沿用通用 12.5%/阶的斜率，
 * 避免新版线性属性池下单段技能过早压到半血以上。
 */
export function qualityScaledDamageCoefficient(base: number): ScalableParam {
  return {
    base: base * DAMAGE_COEFFICIENT_BASE_FACTOR,
    scale: 'quality',
    coefficient: base * DAMAGE_QUALITY_COEFFICIENT_STEP,
  };
}
