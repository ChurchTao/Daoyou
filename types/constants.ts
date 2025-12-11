// 统一的常量与派生类型定义

// 元素
export const ELEMENT_VALUES = [
  '金',
  '木',
  '水',
  '火',
  '土',
  '风',
  '雷',
  '冰',
] as const;
export type ElementType = (typeof ELEMENT_VALUES)[number];

// 技能类型
export const SKILL_TYPE_VALUES = [
  'attack',
  'heal',
  'control',
  'debuff',
  'buff',
] as const;
export type SkillType = (typeof SKILL_TYPE_VALUES)[number];

// 状态效果
export const STATUS_EFFECT_VALUES = [
  'burn',
  'bleed',
  'poison',
  'stun',
  'silence',
  'root',
  'armor_up',
  'speed_up',
  'crit_rate_up',
  'armor_down',
] as const;
export type StatusEffect = (typeof STATUS_EFFECT_VALUES)[number];

// 装备槽位
export const EQUIPMENT_SLOT_VALUES = ['weapon', 'armor', 'accessory'] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOT_VALUES)[number];

// 消耗品类型
export const CONSUMABLE_TYPE_VALUES = ['丹药'] as const;
export type ConsumableType = (typeof CONSUMABLE_TYPE_VALUES)[number];

// 性别
export const GENDER_VALUES = ['男', '女', '无'] as const;
export type GenderType = (typeof GENDER_VALUES)[number];

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

// 境界 + 阶段属性上限（圆满阶段与后期共享同一上限，用于突破前的瓶颈）
export const REALM_STAGE_CAPS: Record<RealmType, Record<RealmStage, number>> = {
  炼气: { 初期: 20, 中期: 40, 后期: 60, 圆满: 60 },
  筑基: { 初期: 80, 中期: 100, 后期: 120, 圆满: 120 },
  金丹: { 初期: 140, 中期: 160, 后期: 180, 圆满: 180 },
  元婴: { 初期: 220, 中期: 240, 后期: 260, 圆满: 260 },
  化神: { 初期: 300, 中期: 320, 后期: 340, 圆满: 340 },
  炼虚: { 初期: 400, 中期: 420, 后期: 440, 圆满: 440 },
  合体: { 初期: 500, 中期: 520, 后期: 560, 圆满: 560 },
  大乘: { 初期: 600, 中期: 620, 后期: 640, 圆满: 640 },
  渡劫: { 初期: 700, 中期: 720, 后期: 740, 圆满: 740 },
} as const;

// 命格吉凶
export const FATE_TYPE_VALUES = ['吉', '凶'] as const;
export type FateType = (typeof FATE_TYPE_VALUES)[number];

// 灵根品阶
export const SPIRITUAL_ROOT_GRADE_VALUES = [
  '天灵根',
  '真灵根',
  '伪灵根',
  '变异灵根',
] as const;
export type SpiritualRootGrade = (typeof SPIRITUAL_ROOT_GRADE_VALUES)[number];

// 技能/功法品阶
export const SKILL_GRADE_VALUES = [
  '天阶上品',
  '天阶中品',
  '天阶下品',
  '地阶上品',
  '地阶中品',
  '地阶下品',
  '玄阶上品',
  '玄阶中品',
  '玄阶下品',
  '黄阶上品',
  '黄阶中品',
  '黄阶下品',
] as const;
export type SkillGrade = (typeof SKILL_GRADE_VALUES)[number];

// 先天气运品质
export const QUALITY_VALUES = [
  '凡品',
  '灵品',
  '玄品',
  '真品',
  '地品',
  '天品',
  '仙品',
  '神品',
] as const;
export type Quality = (typeof QUALITY_VALUES)[number];

// 材料类型
export const MATERIAL_TYPE_VALUES = [
  'herb',
  'ore',
  'monster',
  'tcdb',
  'aux',
] as const;
export type MaterialType = (typeof MATERIAL_TYPE_VALUES)[number];

export const EFFECT_TYPE_VALUES = [
  'damage_bonus',
  'on_hit_add_effect',
  'on_use_cost_hp',
  'environment_change',
];

/**
 * 法宝效果类型
 * - damage_bonus: 伤害加成
 * - on_hit_add_effect: 攻击命中后添加状态效果
 * - on_use_cost_hp: 使用法术消耗气血
 * - environment_change: 环境变化
 */
export type EffectType = (typeof EFFECT_TYPE_VALUES)[number];

/**
 * 消耗品效果
 */
export const CONSUMABLE_EFFECT_VALUES = [
  '永久提升体魄',
  '永久提升灵力',
  '永久提升悟性',
  '永久提升身法',
  '永久提升神识',
] as const;
export type ConsumableEffectType = (typeof CONSUMABLE_EFFECT_VALUES)[number];

// ===== 灵石产出相关 =====

// 境界历练收益基数（每小时）
export const REALM_YIELD_RATES: Record<RealmType, number> = {
  炼气: 100,
  筑基: 200,
  金丹: 400,
  元婴: 800,
  化神: 1600,
  炼虚: 3200,
  合体: 4800,
  大乘: 6400,
  渡劫: 12800,
};

// 排行榜每日结算奖励（灵石）
export const RANKING_REWARDS = {
  1: 30000,
  2: 20000,
  3: 15000,
  '4-10': 8000,
  '11-50': 5000,
  '51-100': 2000,
  default: 1000, // 未上榜（前100）但在榜单统计范围内
};
