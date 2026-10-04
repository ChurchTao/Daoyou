import { type Quality } from '@daoyou/constants/qualities';

import { type RealmType } from '@daoyou/constants/realms';

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

export const CULTIVATION_PILL_MAX_QUALITY_BY_REALM: Record<RealmType, Quality> =
  {
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

export const CULTIVATION_PILL_MIN_QUALITY_BY_REALM: Record<RealmType, Quality> =
  {
    炼气: '凡品',
    筑基: '凡品',
    金丹: '灵品',
    元婴: '玄品',
    化神: '玄品',
    炼虚: '玄品',
    合体: '玄品',
    大乘: '玄品',
    渡劫: '玄品',
  };

export const PILL_TOXICITY_CAP = 1000;

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

export const LIFESPAN_PILL_GAIN_RANGE_BY_QUALITY: Record<
  Quality,
  { min: number; max: number }
> = {
  凡品: { min: 6, max: 10 },
  灵品: { min: 12, max: 20 },
  玄品: { min: 24, max: 36 },
  真品: { min: 40, max: 60 },
  地品: { min: 70, max: 95 },
  天品: { min: 105, max: 135 },
  仙品: { min: 145, max: 175 },
  神品: { min: 180, max: 200 },
};
