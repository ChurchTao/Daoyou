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
  'breakthrough_focus',
  'protect_meridians',
  'clear_mind',
  'cultivation_boost',
  'artifact_damaged',
  'mana_depleted',
  'hp_deficit',
  // 环境状态
  'scorching',
  'freezing',
  'toxic_air',
  'formation_suppressed',
  'abundant_qi',
] as const;

export type StatusEffect = (typeof STATUS_EFFECT_VALUES)[number];


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
