import type {
  ConditionStatusInstance,
  CultivatorCondition,
} from '@daoyou/game-domain/condition';
import { isConditionStatusActive } from '../../condition/index.js';

export const BEAST_LURE_STATUS_KEY = 'beast_lure' as const;
export const BEAST_LURE_SEARCHES = 25;
export const BEAST_LURE_RATE_MULTIPLIER = 4;

export function wildEncounterRateMultiplier(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < 1) return 1;
  return Math.min(BEAST_LURE_RATE_MULTIPLIER, value);
}

export function beastLureCharges(condition: unknown): number {
  return lureUses(findLure(condition));
}

export function igniteBeastLure(
  condition: CultivatorCondition,
  now: Date = new Date(),
): CultivatorCondition {
  const existing = condition.statuses.find(
    (status) => status.key === BEAST_LURE_STATUS_KEY,
  );
  const timestamp = now.toISOString();
  const next: ConditionStatusInstance = {
    key: BEAST_LURE_STATUS_KEY,
    stacks: 1,
    source: 'pill',
    duration: { kind: 'until_removed' },
    usesRemaining: BEAST_LURE_SEARCHES,
    payload: { rateMultiplier: BEAST_LURE_RATE_MULTIPLIER },
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  return {
    ...condition,
    statuses: [
      ...condition.statuses.filter(
        (status) => status.key !== BEAST_LURE_STATUS_KEY,
      ),
      next,
    ],
    timestamps: { ...condition.timestamps, lastPillAt: timestamp },
  };
}

export function spendBeastLureCharge(
  condition: unknown,
  now: Date = new Date(),
): { condition: unknown; multiplier: number; spent: boolean } {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    return { condition, multiplier: 1, spent: false };
  }
  const record = condition as { statuses?: unknown };
  if (!Array.isArray(record.statuses)) {
    return { condition, multiplier: 1, spent: false };
  }
  const index = record.statuses.findIndex((status) => lureUses(status) > 0);
  if (index < 0) return { condition, multiplier: 1, spent: false };
  const current = record.statuses[index] as ConditionStatusInstance;
  const remaining = lureUses(current) - 1;
  const timestamp = now.toISOString();
  const statuses = record.statuses.flatMap((status, statusIndex) => {
    if (statusIndex !== index) return [status];
    if (remaining <= 0) return [];
    return [{ ...current, usesRemaining: remaining, updatedAt: timestamp }];
  });
  return {
    condition: { ...record, statuses },
    multiplier: lureMultiplier(current),
    spent: true,
  };
}

function findLure(condition: unknown): unknown {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) {
    return null;
  }
  const statuses = (condition as { statuses?: unknown }).statuses;
  if (!Array.isArray(statuses)) return null;
  return statuses.find((status) => lureUses(status) > 0) ?? null;
}

function lureUses(status: unknown): number {
  if (!status || typeof status !== 'object') return 0;
  const entry = status as ConditionStatusInstance;
  if (entry.key !== BEAST_LURE_STATUS_KEY || !isConditionStatusActive(entry)) {
    return 0;
  }
  if (typeof entry.usesRemaining !== 'number' || entry.usesRemaining <= 0) {
    return 0;
  }
  return Math.floor(entry.usesRemaining);
}

function lureMultiplier(status: ConditionStatusInstance): number {
  const raw = status.payload?.rateMultiplier;
  return wildEncounterRateMultiplier(
    typeof raw === 'number' ? raw : BEAST_LURE_RATE_MULTIPLIER,
  );
}
