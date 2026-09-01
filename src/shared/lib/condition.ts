import type {
  ConditionResourcePoint,
  ConditionResourceKey,
  ConditionStatusKey,
  ConditionStatusDuration,
  ConditionStatusInstance,
  CultivatorCondition,
} from '@shared/types/condition';
import { getConditionStatusTemplate } from './conditionStatusRegistry';
import {
  createDefaultBodyCultivationState,
  normalizeBodyCultivationState,
} from './bodyCultivation/normalize';
import { PILL_TOXICITY_CAP } from '@shared/config/consumableSystem';

export interface PillToxicityStage {
  key: 'none' | 'light' | 'heavy' | 'critical';
  label: string;
}

export const NATURAL_RECOVERY_CONFIG = {
  hpPerHour: 0.28,
  mpPerHour: 0.38,
  toxicityPenaltyDivisor: 180,
} as const;

const WOUND_STATUS_SEVERITY_ORDER = [
  'minor_wound',
  'major_wound',
  'near_death',
] as const satisfies readonly ConditionStatusKey[];

export function getConditionStatusCureTargets(
  status: ConditionStatusKey,
): ConditionStatusKey[] {
  const woundIndex = WOUND_STATUS_SEVERITY_ORDER.indexOf(
    status as (typeof WOUND_STATUS_SEVERITY_ORDER)[number],
  );
  return woundIndex < 0
    ? [status]
    : WOUND_STATUS_SEVERITY_ORDER.slice(0, woundIndex + 1);
}

export interface NaturalRecoveryEstimate {
  perHour: number;
  timeToFullMs: number | null;
  isFull: boolean;
}

export interface NaturalRecoveryResourceProjection
  extends NaturalRecoveryEstimate {
  current: number;
  max: number;
  recovered: number;
}

export interface NaturalRecoveryProjection {
  resources: {
    hp: Required<ConditionResourcePoint>;
    mp: Required<ConditionResourcePoint>;
  };
  recovery: {
    hp: NaturalRecoveryResourceProjection;
    mp: NaturalRecoveryResourceProjection;
  };
  elapsedMs: number;
  recoveryFactor: number;
  timestampValid: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeResourceMax(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function normalizeProjectedResourceCurrent(
  point: ConditionResourcePoint | undefined,
  runtimeMax: number,
): number {
  const rawCurrent =
    typeof point?.current === 'number' && Number.isFinite(point.current)
      ? Math.floor(point.current)
      : runtimeMax;
  const storedMax =
    typeof point?.max === 'number' &&
    Number.isFinite(point.max) &&
    point.max >= 0
      ? Math.floor(point.max)
      : undefined;
  const shouldPreserveFullState =
    storedMax !== undefined &&
    runtimeMax > storedMax &&
    rawCurrent >= storedMax;

  return shouldPreserveFullState
    ? runtimeMax
    : clamp(rawCurrent, 0, runtimeMax);
}

function getDurationExpiresAt(duration: ConditionStatusDuration): number | null {
  if (duration.kind !== 'time') return null;
  const expiresAt = Date.parse(duration.expiresAt);
  return Number.isFinite(expiresAt) ? expiresAt : null;
}

export function getNextConditionStatusExpiryMs(
  conditionInput: CultivatorCondition | undefined,
  now: Date,
): number | null {
  const nowMs = now.getTime();
  let nextExpiryMs: number | null = null;

  for (const status of conditionInput?.statuses ?? []) {
    if (
      typeof status.usesRemaining === 'number' &&
      status.usesRemaining <= 0
    ) {
      continue;
    }
    const expiresAt = getDurationExpiresAt(status.duration);
    if (expiresAt === null || expiresAt <= nowMs) continue;
    nextExpiryMs =
      nextExpiryMs === null ? expiresAt : Math.min(nextExpiryMs, expiresAt);
  }

  return nextExpiryMs;
}

export function isConditionStatusActive(
  status: ConditionStatusInstance,
  now: Date = new Date(),
): boolean {
  if (
    typeof status.usesRemaining === 'number' &&
    status.usesRemaining <= 0
  ) {
    return false;
  }

  const expiresAt = getDurationExpiresAt(status.duration);
  if (expiresAt !== null && expiresAt <= now.getTime()) {
    return false;
  }

  return true;
}

export function hasActiveConditionStatus(
  conditionInput: CultivatorCondition | undefined,
  statusKey: ConditionStatusKey,
  now: Date = new Date(),
): boolean {
  return (conditionInput?.statuses ?? []).some(
    (status) =>
      status.key === statusKey &&
      isConditionStatusActive(status, now),
  );
}

export function getNaturalRecoveryStatusMultiplier(
  conditionInput: CultivatorCondition | undefined,
  now: Date = new Date(),
): number {
  const condition = conditionInput;
  const activeStatuses = (condition?.statuses ?? []).filter((status) =>
    isConditionStatusActive(status, now),
  );

  return activeStatuses.reduce((lowest, status) => {
    const multiplier = getConditionStatusTemplate(status.key)?.hooks.onNaturalRecovery?.(
      status,
      condition ?? {
        version: 1,
        resources: {
          hp: { current: 0 },
          mp: { current: 0 },
        },
        gauges: {
          pillToxicity: 0,
        },
        tracks: {
          bodyCultivation: createDefaultBodyCultivationState(),
          tempering: {
            vitality: { level: 0, progress: 0 },
            spirit: { level: 0, progress: 0 },
            wisdom: { level: 0, progress: 0 },
            speed: { level: 0, progress: 0 },
            willpower: { level: 0, progress: 0 },
          },
          marrowWash: {
            version: 1,
            level: 0,
            progress: 0,
            realm: 0,
            breakthroughs: 0,
          },
        },
        counters: {
          longTermPillUsesByRealm: {},
          cultivationPillUsesByRealm: {},
          longevityPillUsesByRealm: {},
          bodyCultivationPillUses: 0,
        },
        statuses: [],
        timestamps: {},
      },
    );
    if (typeof multiplier !== 'number' || !Number.isFinite(multiplier)) {
      return lowest;
    }
    return Math.min(lowest, multiplier);
  }, 1);
}

export function getNaturalRecoveryEstimate(options: {
  resource: ConditionResourceKey;
  current: number;
  max: number;
  conditionInput: CultivatorCondition | undefined;
  toxicityPenaltyMultiplier?: number;
  naturalRecoveryMultiplier?: number;
  now?: Date;
}): NaturalRecoveryEstimate {
  const {
    resource,
    current,
    max,
    conditionInput,
    toxicityPenaltyMultiplier = 1,
    naturalRecoveryMultiplier = 1,
    now = new Date(),
  } = options;
  const safeCurrent = Math.max(0, current);
  const safeMax = normalizeResourceMax(max);

  if (safeCurrent >= safeMax) {
    return {
      perHour: 0,
      timeToFullMs: 0,
      isFull: true,
    };
  }

  const toxicityMultiplier = getPillToxicityRecoveryMultiplier(
    conditionInput,
    toxicityPenaltyMultiplier,
  );
  const statusMultiplier = getNaturalRecoveryStatusMultiplier(
    conditionInput,
    now,
  );
  const basePerHour =
    resource === 'hp'
      ? NATURAL_RECOVERY_CONFIG.hpPerHour
      : NATURAL_RECOVERY_CONFIG.mpPerHour;
  const perHour =
    safeMax *
    basePerHour *
    toxicityMultiplier *
    statusMultiplier *
    Math.max(0, naturalRecoveryMultiplier);

  if (perHour <= 0) {
    return {
      perHour: 0,
      timeToFullMs: null,
      isFull: false,
    };
  }

  const deficit = safeMax - safeCurrent;

  return {
    perHour,
    timeToFullMs: Math.ceil((deficit / perHour) * 3600000),
    isFull: false,
  };
}

function projectNaturalRecoveryResource(options: {
  resource: ConditionResourceKey;
  current: number;
  max: number;
  elapsedHours: number;
  conditionInput: CultivatorCondition | undefined;
  toxicityPenaltyMultiplier: number;
  naturalRecoveryMultiplier: number;
  now: Date;
}): NaturalRecoveryResourceProjection {
  const {
    resource,
    current,
    max,
    elapsedHours,
    conditionInput,
    toxicityPenaltyMultiplier,
    naturalRecoveryMultiplier,
    now,
  } = options;
  const estimateAtBaseline = getNaturalRecoveryEstimate({
    resource,
    current,
    max,
    conditionInput,
    toxicityPenaltyMultiplier,
    naturalRecoveryMultiplier,
    now,
  });
  const recovered = Math.max(
    0,
    Math.min(
      max - current,
      Math.floor(estimateAtBaseline.perHour * elapsedHours),
    ),
  );
  const projectedCurrent = clamp(current + recovered, 0, max);
  const estimate = getNaturalRecoveryEstimate({
    resource,
    current: projectedCurrent,
    max,
    conditionInput,
    toxicityPenaltyMultiplier,
    naturalRecoveryMultiplier,
    now,
  });

  return {
    ...estimate,
    current: projectedCurrent,
    max,
    recovered,
  };
}

export function projectNaturalRecoveryResources(options: {
  conditionInput: CultivatorCondition | undefined;
  maxHp: number;
  maxMp: number;
  toxicityPenaltyMultiplier?: number;
  naturalRecoveryMultiplier?: number;
  now: Date;
}): NaturalRecoveryProjection {
  const {
    conditionInput,
    toxicityPenaltyMultiplier = 1,
    naturalRecoveryMultiplier = 1,
    now,
  } = options;
  const maxHp = normalizeResourceMax(options.maxHp);
  const maxMp = normalizeResourceMax(options.maxMp);
  const hpCurrent = normalizeProjectedResourceCurrent(
    conditionInput?.resources.hp,
    maxHp,
  );
  const mpCurrent = normalizeProjectedResourceCurrent(
    conditionInput?.resources.mp,
    maxMp,
  );
  const lastRecoveryAt = Date.parse(
    conditionInput?.timestamps.lastRecoveryAt ?? '',
  );
  const timestampValid = Number.isFinite(lastRecoveryAt);
  const elapsedMs = timestampValid
    ? Math.max(0, now.getTime() - lastRecoveryAt)
    : 0;
  const elapsedHours = elapsedMs / 3_600_000;
  const toxicityMultiplier = getPillToxicityRecoveryMultiplier(
    conditionInput,
    toxicityPenaltyMultiplier,
  );
  const statusMultiplier = getNaturalRecoveryStatusMultiplier(
    conditionInput,
    now,
  );
  const recoveryFactor =
    toxicityMultiplier *
    statusMultiplier *
    Math.max(0, naturalRecoveryMultiplier);
  const hp = projectNaturalRecoveryResource({
    resource: 'hp',
    current: hpCurrent,
    max: maxHp,
    elapsedHours,
    conditionInput,
    toxicityPenaltyMultiplier,
    naturalRecoveryMultiplier,
    now,
  });
  const mp = projectNaturalRecoveryResource({
    resource: 'mp',
    current: mpCurrent,
    max: maxMp,
    elapsedHours,
    conditionInput,
    toxicityPenaltyMultiplier,
    naturalRecoveryMultiplier,
    now,
  });

  return {
    resources: {
      hp: { current: hp.current, max: hp.max },
      mp: { current: mp.current, max: mp.max },
    },
    recovery: { hp, mp },
    elapsedMs,
    recoveryFactor,
    timestampValid,
  };
}

export function getPillToxicityRecoveryMultiplier(
  conditionInput: CultivatorCondition | undefined,
  toxicityPenaltyMultiplier = 1,
): number {
  const qiBloodLevel =
    normalizeBodyCultivationState(conditionInput).tracks.qi_blood.level;
  const bodyCultivationPenaltyMultiplier = clamp(
    1 - qiBloodLevel * 0.003,
    0.75,
    1,
  );

  return clamp(
    1 -
      (Math.max(0, conditionInput?.gauges.pillToxicity ?? 0) /
        NATURAL_RECOVERY_CONFIG.toxicityPenaltyDivisor) *
        Math.max(0, toxicityPenaltyMultiplier) *
        bodyCultivationPenaltyMultiplier,
    0.3,
    1,
  );
}

export function getBreakthroughPenalty(
  conditionInput: CultivatorCondition | undefined,
  toxicityPenaltyMultiplier = 1,
): number {
  const pillToxicity = Math.max(
    0,
    conditionInput?.gauges.pillToxicity ?? 0,
  );
  return clamp(
    (pillToxicity / PILL_TOXICITY_CAP) * Math.max(0, toxicityPenaltyMultiplier),
    0,
    0.18,
  );
}

export function getBreakthroughPenaltyPercent(
  conditionInput: CultivatorCondition | undefined,
  toxicityPenaltyMultiplier = 1,
): number {
  return Number(
    (
      getBreakthroughPenalty(conditionInput, toxicityPenaltyMultiplier) * 100
    ).toFixed(1),
  );
}

export function getPillToxicityStage(
  conditionInput: CultivatorCondition | undefined,
): PillToxicityStage {
  const pillToxicity = Math.max(
    0,
    conditionInput?.gauges.pillToxicity ?? 0,
  );

  if (pillToxicity >= 700) {
    return { key: 'critical', label: '毒火攻心' };
  }
  if (pillToxicity >= 400) {
    return { key: 'heavy', label: '丹毒郁结' };
  }
  if (pillToxicity >= 200) {
    return { key: 'light', label: '丹毒轻染' };
  }
  return { key: 'none', label: '无明显丹毒' };
}
