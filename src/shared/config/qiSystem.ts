export const QI_MAX = 200;
export const QI_DAILY_REFRESH = 200;
export const QI_OVERFLOW_MAX = 300;
export const QI_DAILY_RESTORE_ITEM_LIMIT = 3;
export const QI_REFRESH_TIMEZONE = 'Asia/Shanghai';

export const QI_ACTION_COSTS = {
  dungeon_start: 50,
  retreat_10_years: 4,
  breakthrough_attempt: 20,
  alchemy_improvised: 2,
  alchemy_formula: 2,
  creation_artifact: 8,
  creation_gongfa: 8,
  creation_skill: 8,
} as const;

export type QiAction = keyof typeof QI_ACTION_COSTS;

export const QI_RESTORE_TALISMAN_SCENARIOS = {
  qi_restore_small: { amount: 50, label: '小聚灵符' },
  qi_restore_medium: { amount: 100, label: '中聚灵符' },
  qi_restore_large: { amount: 200, label: '大聚灵符' },
  qi_restore_fill_to_max: { amount: 'fill_to_max', label: '天地引气符' },
} as const;

export type QiRestoreTalismanScenario =
  keyof typeof QI_RESTORE_TALISMAN_SCENARIOS;

export function isQiAction(value: string): value is QiAction {
  return Object.prototype.hasOwnProperty.call(QI_ACTION_COSTS, value);
}

export function isQiRestoreTalismanScenario(
  value: string,
): value is QiRestoreTalismanScenario {
  return Object.prototype.hasOwnProperty.call(
    QI_RESTORE_TALISMAN_SCENARIOS,
    value,
  );
}

export function getRetreatQiCost(years: number): number {
  return Math.ceil(Math.max(0, years) / 10) * QI_ACTION_COSTS.retreat_10_years;
}
