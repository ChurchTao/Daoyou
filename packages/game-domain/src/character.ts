// 性别
export const GENDER_VALUES = ['男', '女'] as const;

export type GenderType = (typeof GENDER_VALUES)[number];


// 敌人种族
export const ENEMY_RACE_VALUES = [
  '人族',
  '妖族',
  '鬼魂',
  '魔族',
  '古兽',
  '灵族',
] as const;

export type EnemyRace = (typeof ENEMY_RACE_VALUES)[number];


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
