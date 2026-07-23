import type { SectOrganizationTheme } from '../../core';

export const WUXIANG_ORGANIZATION_THEME: SectOrganizationTheme = {
  taskPresentation: {
    gate_sweep: { description: '沿照壁清理昨夜落下的香灰与血莲残瓣。', actionLabel: '前往照壁洒扫' },
    weekly_tournament: { description: '在无相木人前验证佛魔转相是否仍守得住一念。' },
    elder_trial: { description: '承受戒律师三问，再以所得之业照还其身。' },
  },
  shopGrants: {
    true_cloud_ore: { name: '无相骨玉', description: '血池石壁中凝出的白色矿髓，温润如骨。' },
    true_spirit_pill: { name: '照身定念丹' },
  },
  opponents: {
    weekly_tournament: { name: '无相试身木人' },
    elder_trial: { name: '戒律师法身' },
  },
  facilityNames: { archive: '贝叶藏', cultivation_room: '止观室', workshop: '火供院' },
  stipendGrantNames: { trueHerb: '血莲心' },
};
