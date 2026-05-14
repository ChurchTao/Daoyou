import { AttributeType } from './types';

/**
 * 百分比语义属性：
 * - FIXED 代表直接增加 0.12 / 0.25 这类百分比点数
 * - ADD 代表在当前底座上再乘一个百分比系数
 */
export const PERCENTAGE_ATTRIBUTE_TYPES = new Set<AttributeType>([
  AttributeType.CRIT_RATE,
  AttributeType.CRIT_DAMAGE_MULT,
  AttributeType.EVASION_RATE,
  AttributeType.CONTROL_HIT,
  AttributeType.CONTROL_RESISTANCE,
  AttributeType.ARMOR_PENETRATION,
  AttributeType.MAGIC_PENETRATION,
  AttributeType.CRIT_RESIST,
  AttributeType.CRIT_DAMAGE_REDUCTION,
  AttributeType.ACCURACY,
  AttributeType.HEAL_AMPLIFY,
]);

export function isPercentageAttributeType(attrType: AttributeType): boolean {
  return PERCENTAGE_ATTRIBUTE_TYPES.has(attrType);
}
