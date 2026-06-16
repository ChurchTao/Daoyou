import type {
  ConditionStatusInstance,
  CultivatorCondition,
} from '@shared/types/condition';
import type { Quality } from '@shared/types/constants';
import type { AddStatusOperation } from '@shared/types/consumable';
import { isConditionStatusActive } from './condition';

export const CULTIVATION_BOOST_STATUS_KEY = 'cultivation_boost' as const;

export const CULTIVATION_BOOST_BY_QUALITY: Record<Quality, number> = {
  凡品: 0.5,
  灵品: 0.6411,
  玄品: 0.943,
  真品: 1.3648,
  地品: 1.8901,
  天品: 2.5089,
  仙品: 3.214,
  神品: 4,
};

const MIN_CULTIVATION_BOOST = 0.3;
const MAX_CULTIVATION_BOOST = 8;

export interface CultivationBoostPayload
  extends Record<string, string | number | boolean> {
  boostPercent: number;
  retreatExpMultiplier: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeCultivationBoostPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_CULTIVATION_BOOST;
  }
  return Number(
    clamp(value, MIN_CULTIVATION_BOOST, MAX_CULTIVATION_BOOST).toFixed(4),
  );
}

export function buildCultivationBoostPayload(
  boostPercent: number,
): CultivationBoostPayload {
  const normalizedBoost = normalizeCultivationBoostPercent(boostPercent);
  return {
    boostPercent: normalizedBoost,
    retreatExpMultiplier: Number((1 + normalizedBoost).toFixed(4)),
  };
}

export function buildCultivationBoostOperation(
  quality: Quality,
  factor = 1,
): AddStatusOperation {
  const base = CULTIVATION_BOOST_BY_QUALITY[quality] ?? MIN_CULTIVATION_BOOST;
  return {
    type: 'add_status',
    status: CULTIVATION_BOOST_STATUS_KEY,
    usesRemaining: 1,
    payload: buildCultivationBoostPayload(base * factor),
  };
}

export function scaleCultivationBoostOperation(
  operation: AddStatusOperation,
  factor: number,
): AddStatusOperation {
  if (operation.status !== CULTIVATION_BOOST_STATUS_KEY) {
    return operation;
  }

  const currentBoost = getCultivationBoostPercent(operation);
  return {
    ...operation,
    payload: buildCultivationBoostPayload(currentBoost * factor),
  };
}

export function getCultivationBoostPercent(
  value: Pick<AddStatusOperation, 'payload'> | ConditionStatusInstance,
): number {
  const raw = value.payload;
  const payloadBoost =
    typeof raw?.boostPercent === 'number' ? raw.boostPercent : undefined;
  const multiplierBoost =
    typeof raw?.retreatExpMultiplier === 'number'
      ? raw.retreatExpMultiplier - 1
      : undefined;
  return normalizeCultivationBoostPercent(payloadBoost ?? multiplierBoost ?? 0);
}

export function getCultivationBoostDisplayText(
  value: Pick<AddStatusOperation, 'payload'> | ConditionStatusInstance,
): string {
  const percent = Number((getCultivationBoostPercent(value) * 100).toFixed(1));
  return `下次闭关修为 +${
    Number.isInteger(percent) ? percent.toFixed(0) : percent
  }%`;
}

export function getActiveCultivationBoostStatus(
  condition: CultivatorCondition | undefined,
  now: Date = new Date(),
): ConditionStatusInstance | null {
  const statuses = condition?.statuses ?? [];
  const activeBoosts = statuses.filter(
    (status) =>
      status.key === CULTIVATION_BOOST_STATUS_KEY &&
      isConditionStatusActive(status, now) &&
      (status.usesRemaining ?? 1) > 0,
  );

  if (activeBoosts.length === 0) {
    return null;
  }

  return activeBoosts.reduce((best, status) =>
    getCultivationBoostPercent(status) > getCultivationBoostPercent(best)
      ? status
      : best,
  );
}

export function getCultivationBoostRetreatMultiplier(
  condition: CultivatorCondition | undefined,
  now: Date = new Date(),
): number {
  const status = getActiveCultivationBoostStatus(condition, now);
  if (!status) {
    return 1;
  }
  return 1 + getCultivationBoostPercent(status);
}

export function consumeCultivationBoostStatus(
  condition: CultivatorCondition,
): CultivatorCondition {
  return {
    ...condition,
    statuses: condition.statuses.filter(
      (status) => status.key !== CULTIVATION_BOOST_STATUS_KEY,
    ),
  };
}
