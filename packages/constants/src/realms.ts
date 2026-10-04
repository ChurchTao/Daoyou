// 境界
export const REALM_VALUES = [
  '炼气',
  '筑基',
  '金丹',
  '元婴',
  '化神',
  '炼虚',
  '合体',
  '大乘',
  '渡劫',
] as const;

export type RealmType = (typeof REALM_VALUES)[number];


// 境界阶段
export const REALM_STAGE_VALUES = ['初期', '中期', '后期', '圆满'] as const;

export type RealmStage = (typeof REALM_STAGE_VALUES)[number];


// 境界等级映射（用于缩放计算）
export const REALM_ORDER: Record<RealmType, number> = {
  炼气: 0,
  筑基: 1,
  金丹: 2,
  元婴: 3,
  化神: 4,
  炼虚: 5,
  合体: 6,
  大乘: 7,
  渡劫: 8,
};
