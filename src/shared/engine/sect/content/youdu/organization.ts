import type { SectOrganizationTheme } from '../../core';

export const YOUDU_ORGANIZATION_THEME: SectOrganizationTheme = {
  taskPresentation: {
    gate_sweep: {
      description: '沿黑水石径巡查魂灯，记下倒影与行人错开的每一瞬。',
      actionLabel: '前往黑水巡灯',
    },
    weekly_tournament: { description: '在照影场校验招魂、镇魄与送魂之法。' },
    elder_trial: { description: '随引魂师穿过七灯，守住自己的姓名与归路。' },
  },
  shopGrants: {
    true_cloud_ore: { name: '镇魂铁', description: '黑水阴脉中沉积的旧铁，可稳固器物神韵。' },
    true_spirit_pill: { name: '返照定魂丹' },
  },
  opponents: {
    weekly_tournament: { name: '照影试魂傀' },
    elder_trial: { name: '引魂师法身' },
  },
  facilityNames: { archive: '三魂阁', cultivation_room: '返照室', workshop: '镇铁炉' },
  stipendGrantNames: { trueHerb: '返照香' },
};

