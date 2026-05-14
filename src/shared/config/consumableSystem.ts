import { QUALITY_ORDER, type Quality, type RealmType } from '@shared/types/constants';

export const REALM_PILL_USAGE_LIMITS: Record<RealmType, number> = {
  炼气: 6,
  筑基: 8,
  金丹: 10,
  元婴: 12,
  化神: 14,
  炼虚: 16,
  合体: 18,
  大乘: 20,
  渡劫: 24,
};

export function getConsumableQualityScalar(quality: Quality | undefined): number {
  return 1 + (QUALITY_ORDER[quality ?? '凡品'] ?? 0) * 0.22;
}

export const CONSUMABLE_TOXICITY_DEFAULTS = {
  healing: 4,
  mana: 3,
  cultivation: 9,
  breakthrough: 12,
  permanent_attribute: 10,
  marrow_wash: 14,
  detox: -8,
  poison_control: -5,
} as const;

