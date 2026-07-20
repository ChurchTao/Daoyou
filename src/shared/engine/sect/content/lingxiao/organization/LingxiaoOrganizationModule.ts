import {
  StandardSectOrganizationModule,
  type SectOrganizationTheme,
} from '../../../core';

/** 凌霄只声明组织玩法的展示主题；核心流程由标准组织模块提供。 */
export const LINGXIAO_ORGANIZATION_THEME: SectOrganizationTheme = {
  taskPresentation: {
    gate_sweep: {
      description: '循落叶纹路清理云阶，完成一轮山门勤务。',
      actionLabel: '进入云阶清扫',
    },
    weekly_tournament: { description: '在试剑傀儡前验证本周修行。' },
    elder_trial: { description: '击败传功长老剑影，取得真传资格。' },
  },
  shopGrants: {
    true_cloud_ore: {
      name: '凌霄云铁',
      description: '凌霄峰云海灵压凝成的稀有灵铁。',
    },
    true_spirit_pill: { name: '凌霄蕴神丹' },
  },
  opponents: {
    weekly_tournament: { name: '同门试剑傀儡' },
    elder_trial: { name: '传功长老剑影' },
  },
  stipendGrantNames: { trueHerb: '凌霄灵蕴草' },
};

export class LingxiaoOrganizationModule extends StandardSectOrganizationModule {
  constructor() {
    super(LINGXIAO_ORGANIZATION_THEME);
  }
}

export const LINGXIAO_ORGANIZATION = new LingxiaoOrganizationModule();
