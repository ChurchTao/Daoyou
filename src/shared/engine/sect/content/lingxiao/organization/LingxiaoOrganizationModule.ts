import {
  StandardSectOrganizationModule,
  type SectOrganizationTheme,
} from '../../../core';

/** 红尘剑宗只声明组织玩法的展示主题；核心流程由标准组织模块提供。 */
export const LINGXIAO_ORGANIZATION_THEME: SectOrganizationTheme = {
  taskPresentation: {
    gate_sweep: {
      description: '沿通往山下的石阶清理落叶，完成一轮山门勤务。',
      actionLabel: '前往山阶清扫',
    },
    weekly_tournament: { description: '在试剑台与同门剑影验证本周修行。' },
    elder_trial: { description: '接下传功长老三式问剑，取得真传资格。' },
  },
  shopGrants: {
    true_cloud_ore: {
      name: '百炼山铁',
      description: '红尘剑宗山腹反复受地火淬炼的稀有灵铁。',
    },
    true_spirit_pill: { name: '问剑蕴神丹' },
  },
  opponents: {
    weekly_tournament: { name: '同门试剑傀儡' },
    elder_trial: { name: '传功长老剑影' },
  },
  stipendGrantNames: { trueHerb: '剑叶灵草' },
};

export class LingxiaoOrganizationModule extends StandardSectOrganizationModule {
  constructor() {
    super(LINGXIAO_ORGANIZATION_THEME);
  }
}

export const LINGXIAO_ORGANIZATION = new LingxiaoOrganizationModule();
