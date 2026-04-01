import { CreationProductType } from '../types';
import { CREATION_SLUG_CONFIG } from '../config/CreationSlugConfig';

export function buildAbilitySlug(
  sessionId: string,
  productType?: CreationProductType,
): string {
  return productType
    ? `${CREATION_SLUG_CONFIG.abilityPrefix}-${productType}-${sessionId}`
    : `${CREATION_SLUG_CONFIG.abilityPrefix}-${sessionId}`;
}

export function buildStatBuffId(
  attrType: string,
  modType: string,
): string {
  return `${CREATION_SLUG_CONFIG.statBuffPrefix}-${attrType}-${modType}`;
}