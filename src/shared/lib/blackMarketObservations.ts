import type { BlackMarketObservation } from '@shared/types/blackMarket';
import { QUALITY_VALUES } from '@shared/types/constants';

export interface BlackMarketObservationCandidate extends Omit<
  BlackMarketObservation,
  'source'
> {
  safeFact: string;
  truthExplanation: string;
}

const PRICE_PATTERN = /\d[\d,，]*(?:\.\d+)?\s*(?:灵石|到|至|~|～|-)/g;

export function sanitizeBlackMarketObservationText(
  text: string,
  hiddenName: string,
): string {
  let next = text.trim().replace(PRICE_PATTERN, '些许');
  if (hiddenName) next = next.split(hiddenName).join('某物');
  for (const quality of QUALITY_VALUES) {
    next = next.split(quality).join('品阶难辨');
  }
  return next.replace(/\s+/g, ' ').slice(0, 180);
}
