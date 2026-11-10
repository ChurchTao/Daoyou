import {
  QUALITY_ORDER,
  QUALITY_VALUES,
  type Quality,
} from '@daoyou/constants/qualities';

/** Existing alchemy price curve; inventory migration does not change prices. */
export function calculateAlchemyCost(rank: Quality): number {
  return 1600 * Math.pow(2, QUALITY_ORDER[rank]);
}

/** 灵气按整数结算：推演首付 30% 向上取整，成丹补齐余额。 */
export function calculateAlchemyAnalysisQiCost(totalQiCost: number): number {
  return Math.ceil((totalQiCost * 3) / 10);
}

/** 以凭据中的实付首款抵扣，兼容已付全款的有效推演。 */
export function calculateAlchemyCraftQiCost(
  totalQiCost: number,
  qiCostPaid = 0,
): number {
  return Math.max(0, totalQiCost - qiCostPaid);
}

export function calculateHighestMaterialRank(
  materials: Array<{ rank: Quality }>,
): Quality {
  let maxIndex = 0;
  for (const material of materials) {
    const index = QUALITY_VALUES.indexOf(material.rank);
    if (index > maxIndex) maxIndex = index;
  }
  return QUALITY_VALUES[maxIndex];
}
