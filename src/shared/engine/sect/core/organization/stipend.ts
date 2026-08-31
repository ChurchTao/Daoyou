import { REALM_DAILY_EXP_BUDGET } from '@shared/config/cultivationExpGain';
import type { RealmType } from '@shared/types/constants';
import type { SectDiscipleRank } from '../domain';

export const STANDARD_SECT_STIPEND_CURVE = {
  // Weekly passive income starts at two realm daily budgets, then rank and
  // spirit-vein multipliers reward sect progression without replacing tasks.
  realmDailyBudgetMultiplier: 2,
  rankMultiplierBps: {
    registered: 7_500,
    outer: 10_000,
    inner: 12_500,
    true: 15_000,
  },
  roundUnit: 100,
} as const;

export function calculateStandardSectStipendBase(
  rank: SectDiscipleRank,
  realm: RealmType,
): number {
  const curve = STANDARD_SECT_STIPEND_CURVE;
  const raw =
    REALM_DAILY_EXP_BUDGET[realm] *
    curve.realmDailyBudgetMultiplier *
    (curve.rankMultiplierBps[rank] / 10_000);
  return Math.round(raw / curve.roundUnit) * curve.roundUnit;
}
