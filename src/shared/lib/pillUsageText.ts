import {
  CULTIVATION_PILL_USAGE_LIMITS,
  REALM_PILL_USAGE_LIMITS,
} from '@shared/config/consumableSystem';
import type { RealmType } from '@shared/types/constants';
import type { PillQuotaCategory, PillSpec } from '@shared/types/consumable';

export function getRealmPillUsageLimit(realm: RealmType): number {
  return REALM_PILL_USAGE_LIMITS[realm];
}

export function getCultivationPillUsageLimit(realm: RealmType): number {
  return CULTIVATION_PILL_USAGE_LIMITS[realm];
}

export function getLongevityPillUsageLimit(realm: RealmType): number {
  return REALM_PILL_USAGE_LIMITS[realm];
}

export function isPrimaryBodyCultivationPillSpec(spec: PillSpec): boolean {
  return spec.family === 'tempering';
}

export function getPrimaryPillQuotaCategory(
  spec: PillSpec,
): PillQuotaCategory {
  switch (spec.family) {
    case 'longevity':
      return 'longevity';
    default:
      return 'none';
  }
}

function getKnownUsageLimit(
  quotaCategory: PillQuotaCategory,
  realm: RealmType,
): number | null {
  const limit =
    quotaCategory === 'cultivation'
      ? getCultivationPillUsageLimit(realm)
      : quotaCategory === 'longevity'
        ? getLongevityPillUsageLimit(realm)
        : getRealmPillUsageLimit(realm);

  return Number.isFinite(limit) ? limit : null;
}

export function getPillUsageKeywordLabel(
  quotaCategory: PillQuotaCategory,
  realm?: RealmType,
): string | null {
  if (quotaCategory === 'none') {
    return null;
  }

  if (!realm) {
    return quotaCategory === 'longevity'
      ? '寿元丹上限随境界变化'
      : '服用上限随境界变化';
  }

  const limit = getKnownUsageLimit(quotaCategory, realm);
  if (limit === null) {
    return quotaCategory === 'longevity'
      ? '寿元丹上限随境界变化'
      : '服用上限随境界变化';
  }

  if (quotaCategory === 'longevity') {
    return `寿元丹上限 ${limit} 次`;
  }

  return `服用上限 ${limit} 次`;
}

export function getPillUsageRuleText(
  quotaCategory: PillQuotaCategory,
  realm?: RealmType,
): string | null {
  if (quotaCategory === 'none') {
    return null;
  }

  if (!realm) {
    return quotaCategory === 'longevity'
      ? '寿元丹服用上限：随当前境界变化'
      : '服用上限：随当前境界变化';
  }

  const limit = getKnownUsageLimit(quotaCategory, realm);
  if (limit === null) {
    return quotaCategory === 'longevity'
      ? '寿元丹服用上限：随当前境界变化'
      : '服用上限：随当前境界变化';
  }

  if (quotaCategory === 'longevity') {
    return `寿元丹服用上限：${limit} 次`;
  }

  return `服用上限：${limit} 次`;
}

export function getPillUsageLimitReachedText(
  quotaCategory: PillQuotaCategory,
  used: number,
  limit: number,
): string {
  return `${
    quotaCategory === 'cultivation'
      ? '该修为丹'
      : quotaCategory === 'longevity'
        ? '该寿元丹'
        : '该丹药'
  }服用次数已达上限（当前境界 ${used}/${limit}），无法继续服用。`;
}
