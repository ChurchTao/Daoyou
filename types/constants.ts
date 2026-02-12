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
  // 战斗状态 - Buff
  'armor_up',
  'speed_up',
  'crit_rate_up',
  // 战斗状态 - Debuff
  'armor_down',
  'crit_rate_down',
  // 战斗状态 - Control
  'stun',
  'silence',
  'root',
  // 战斗状态 - DOT
  'burn',
  'bleed',
  'poison',
  // 持久状态
  'weakness',
  'minor_wound',
  'major_wound',
  'near_death',
  'artifact_damaged',
  'mana_depleted',
  'hp_deficit',
  'enlightenment',
  'willpower_enhanced',
  'fate_blessing',
  // 环境状态
  'scorching',
  'freezing',
  'toxic_air',
  'formation_suppressed',
  'abundant_qi',
] as const;
export type StatusEffect = (typeof STATUS_EFFECT_VALUES)[number];

// 装备槽位
export const EQUIPMENT_SLOT_VALUES = ['weapon', 'armor', 'accessory'] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOT_VALUES)[number];

// 消耗品类型
export const CONSUMABLE_TYPE_VALUES = ['丹药', '符箓'] as const;
export type ConsumableType = (typeof CONSUMABLE_TYPE_VALUES)[number];

// 性别
export const GENDER_VALUES = ['男', '女'] as const;
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
  炼气: { 初期: 20, 中期: 25, 后期: 30, 圆满: 30 },
  筑基: { 初期: 40, 中期: 50, 后期: 60, 圆满: 60 },
  金丹: { 初期: 80, 中期: 100, 后期: 120, 圆满: 120 },
  元婴: { 初期: 160, 中期: 200, 后期: 240, 圆满: 240 },
  化神: { 初期: 320, 中期: 400, 后期: 480, 圆满: 480 },
  炼虚: { 初期: 640, 中期: 800, 后期: 960, 圆满: 960 },
  合体: { 初期: 1280, 中期: 1600, 后期: 1920, 圆满: 1920 },
  大乘: { 初期: 2560, 中期: 3200, 后期: 3840, 圆满: 3840 },
  渡劫: { 初期: 5120, 中期: 6400, 后期: 7680, 圆满: 7680 },
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

// 品质等级映射（用于缩放计算）
export const QUALITY_ORDER: Record<Quality, number> = {
  凡品: 0,
  灵品: 1,
  玄品: 2,
  真品: 3,
  地品: 4,
  天品: 5,
  仙品: 6,
  神品: 7,
};

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

// 材料类型
export const MATERIAL_TYPE_VALUES = [
  'herb',
  'ore',
  'monster',
  'tcdb',
  'aux',
  'gongfa_manual',
  'skill_manual',
  // deprecated: legacy type, kept for backward compatibility
  'manual',
] as const;
export type MaterialType = (typeof MATERIAL_TYPE_VALUES)[number];

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
