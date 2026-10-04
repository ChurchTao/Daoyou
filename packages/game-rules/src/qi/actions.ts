import type {
  QiAction,
  QiRestoreTalismanScenario,
} from '@daoyou/game-domain/qi';
import {
  QI_ACTION_COSTS,
  QI_RESTORE_TALISMAN_SCENARIOS,
} from '@daoyou/game-content/qi/config';

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
