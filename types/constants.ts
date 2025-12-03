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
export const CONSUMABLE_TYPE_VALUES = [
  'heal',
  'buff',
  'revive',
  'breakthrough',
] as const;
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
export const FATE_QUALITY_VALUES = ['凡品', '灵品', '玄品', '真品'] as const;
export type FateQuality = (typeof FATE_QUALITY_VALUES)[number];
