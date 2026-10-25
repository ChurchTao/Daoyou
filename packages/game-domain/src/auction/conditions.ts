import { ELEMENT_VALUES } from '@daoyou/constants/elements';
import { QUALITY_VALUES } from '@daoyou/constants/qualities';
import { z } from 'zod';

import {
  INVENTORY_MATERIAL_TYPES,
  MATERIAL_TYPE_NAMES,
} from '../items/material-facts.js';

export const AuctionMaterialConditionElementSchema = z.union([
  z.literal('any'),
  z.literal('none'),
  z.enum(ELEMENT_VALUES),
]);

/** 材料收购条件：类型与五行为空表示不限，品质固定。名称和描述不参与匹配。 */
export const AuctionMaterialConditionSchema = z.strictObject({
  type: z.enum(INVENTORY_MATERIAL_TYPES).nullable().default(null),
  quality: z.enum(QUALITY_VALUES),
  element: AuctionMaterialConditionElementSchema.default('any'),
});

export type AuctionMaterialCondition = z.infer<
  typeof AuctionMaterialConditionSchema
>;

export function auctionMaterialConditionLabel(
  condition: AuctionMaterialCondition,
): string {
  const type = condition.type ? MATERIAL_TYPE_NAMES[condition.type] : null;
  const element =
    condition.element === 'any'
      ? '五行不限'
      : condition.element === 'none'
        ? '无属性'
        : `${condition.element}属性`;
  return type
    ? `${condition.quality}${type}（${element}）`
    : `任意${condition.quality}材料（${element}）`;
}
