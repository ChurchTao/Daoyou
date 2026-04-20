/*
 * SlugService: 生成能力与 buff 标识符（slug/id）的工具函数。
 * 用于保证能力与 buff 在不同环境下具有稳定且唯一的标识符（包含 productType 与 sessionId）。
 */
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