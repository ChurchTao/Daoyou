import { SECT_METHODS } from './method-pack';
import type { SectDefinitionV6 } from './types';
import { WUXIANG_COMBAT } from './wuxiang-pack';
import { WUXIANG_PATHS } from './wuxiang-path-pack';

export const WUXIANG_V6_ID = 'wuxiang' as const;
export const WUXIANG_PATH_ID = {
  Compassion: 'wuxiang.path.compassion',
  Wrath: 'wuxiang.path.wrath',
} as const;
export const WUXIANG_RESOURCE_ID = {
  Fierce: 'wuxiang.resource.fierce',
  Still: 'wuxiang.resource.still',
} as const;
export const WUXIANG_METHOD_ID = {
  Canon: 'wuxiang.method.canon',
  Compassion: 'wuxiang.method.compassion',
  Guardian: 'wuxiang.method.guardian',
  Wrath: 'wuxiang.method.wrath',
  Purity: 'wuxiang.method.purity',
  Crossing: 'wuxiang.method.crossing',
} as const;
export const WUXIANG_SKILL_ID = {
  Mind: 'wuxiang.skill.mind',
  Pierce: 'wuxiang.skill.pierce',
  Nectar: 'wuxiang.skill.nectar',
  Ward: 'wuxiang.skill.ward',
  Empower: 'wuxiang.skill.empower',
  Turn: 'wuxiang.skill.turn',
  Restore: 'wuxiang.skill.restore',
  Strike: 'wuxiang.skill.strike',
  Stars: 'wuxiang.skill.stars',
  Expose: 'wuxiang.skill.expose',
  Burn: 'wuxiang.skill.burn',
  Vow: 'wuxiang.skill.vow',
  Renew: 'wuxiang.skill.renew',
  Revive: 'wuxiang.skill.revive',
  Insight: 'wuxiang.skill.insight',
  Unbind: 'wuxiang.skill.unbind',
  Overload: 'wuxiang.skill.overload',
  Cleanse: 'wuxiang.skill.cleanse',
} as const;
export const WUXIANG_STATUS_ID = {
  Demon: 'wuxiang.status.demon',
  Buddha: 'wuxiang.status.buddha',
  Vow: 'wuxiang.status.vow',
  Breach: 'wuxiang.status.breach',
  Ward: 'wuxiang.status.ward',
  Empower: 'wuxiang.status.empower',
} as const;

export const WUXIANG_V6_DEFINITION: SectDefinitionV6 = {
  id: WUXIANG_V6_ID,
  name: '无相禅宗',
  methods: SECT_METHODS.wuxiang,
  skills: WUXIANG_COMBAT.baseSkills,
  statuses: WUXIANG_COMBAT.statuses,
  paths: WUXIANG_PATHS,
};
