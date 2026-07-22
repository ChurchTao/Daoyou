import type { SectOrganizationTheme } from '../../core';

export const TIANYAN_ORGANIZATION_THEME: SectOrganizationTheme = {
  taskPresentation: {
    gate_sweep: {
      description: '沿观象门与中宫之间校正被云雨冲乱的五行地刻，并记录今日偏差。',
      actionLabel: '前往观象阶校正地刻',
    },
    weekly_tournament: {
      description: '在中宫演法台与同门推演傀儡验证本周神通次序。',
      actionLabel: '参加中宫衍法',
    },
    elder_trial: {
      description: '接下河洛长老布置的三局残阵，在有限术式中完成破局。',
      actionLabel: '应对河洛问局',
    },
  },
  shopGrants: {
    true_cloud_ore: {
      name: '归流玄铜',
      description: '太白峰白铜屋面集露后析出的灵铜，表面水纹会随五峰余势改变。',
    },
    true_spirit_pill: { name: '太初蕴神丹' },
  },
  opponents: {
    weekly_tournament: { name: '同门推演傀儡' },
    elder_trial: { name: '河洛长老法影' },
  },
  facilityNames: {
    archive: '五经阁',
    cultivation_room: '太初静室',
    workshop: '太白铸府',
  },
  stipendGrantNames: { trueHerb: '青华衍生草' },
};
