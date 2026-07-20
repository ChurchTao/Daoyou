export const WUXIANG_SECT_ID = 'wuxiang';
export const WUXIANG_WAR_INTENT = 'sect.wuxiang.war-intent';
export const WUXIANG_FORM_MODE = 'sect.wuxiang.form';
export const WUXIANG_KARMA_BUFF = 'sect.wuxiang.karma-mark';
export const WUXIANG_BLOOD_TIDE_MEMORY = 'sect.wuxiang.blood-tide';
export const WUXIANG_MIRROR_PATH_ID = 'mirror-karma';
export const WUXIANG_DEMON_PATH_ID = 'demon-crossing';

export const WUXIANG_TECHNIQUE_IDS = [
  'flower-heart',
  'blood-tide',
  'three-knocks',
  'observe-calamity',
  'five-skandhas',
  'reed-crossing',
] as const;

export type WuxiangTechniqueId = (typeof WUXIANG_TECHNIQUE_IDS)[number];
