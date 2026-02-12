import type { MaterialType } from '@/types/constants';

export function isLegacyManual(type: MaterialType): boolean {
  return type === 'manual';
}

export function isGongFaManual(type: MaterialType): boolean {
  return type === 'gongfa_manual' || isLegacyManual(type);
}

export function isSkillManual(type: MaterialType): boolean {
  return type === 'skill_manual' || isLegacyManual(type);
}

export function isAnyManual(type: MaterialType): boolean {
  return (
    type === 'gongfa_manual' || type === 'skill_manual' || isLegacyManual(type)
  );
}

/**
 * Ensure newly generated materials never use legacy `manual` as output type.
 * Legacy data can still be consumed by compatibility checks.
 */
export function normalizeGeneratedManualType(
  type: MaterialType,
  fallback: 'gongfa_manual' | 'skill_manual' = 'gongfa_manual',
): MaterialType {
  if (type === 'manual') return fallback;
  return type;
}
