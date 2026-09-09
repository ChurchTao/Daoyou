import {
  QUALITY_ORDER,
  QUALITY_VALUES,
  type Quality,
} from '../types/constants';

/** Existing alchemy price curve; inventory migration does not change prices. */
export function calculateAlchemyCost(rank: Quality): number {
  return 1600 * Math.pow(2, QUALITY_ORDER[rank]);
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
