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

export const CULTIVATION_PILL_USAGE_LIMITS: Record<RealmType, number> = {
  炼气: 10,
  筑基: 20,
  金丹: 30,
  元婴: 40,
  化神: 50,
  炼虚: 60,
  合体: 70,
  大乘: 80,
  渡劫: 90,
};

export const CULTIVATION_PILL_MAX_QUALITY_BY_REALM: Record<RealmType, Quality> = {
  炼气: '玄品',
  筑基: '真品',
  金丹: '地品',
  元婴: '天品',
  化神: '神品',
  炼虚: '神品',
  合体: '神品',
  大乘: '神品',
  渡劫: '神品',
};

export function getConsumableQualityScalar(quality: Quality | undefined): number {
  return 1 + (QUALITY_ORDER[quality ?? '凡品'] ?? 0) * 0.22;
}

export const CONSUMABLE_TOXICITY_DEFAULTS = {
  healing: 4,
  mana: 3,
  cultivation: 9,
  insight: 5,
  breakthrough: 12,
  permanent_attribute: 10,
  marrow_wash: 14,
  detox: -8,
  poison_control: -5,
} as const;
