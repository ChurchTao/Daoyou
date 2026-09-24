import {
  QI_MAX,
  QI_NATURAL_RESTORE_INTERVAL_MS,
  QI_NATURAL_RESTORE_PER_INTERVAL,
  QI_OVERFLOW_MAX,
} from '@shared/config/qiSystem';

export type QiRecoveryStatus = 'recovering' | 'full' | 'overflow' | 'unknown';

export interface NaturalQiRecoveryProjection {
  status: QiRecoveryStatus;
  nextRestoreAt: Date | null;
  fullRestoreAt: Date | null;
  nextRestoreInMs: number | null;
  fullRestoreInMs: number | null;
}

export interface NaturalQiProjection {
  current: number;
  max: number;
  restored: number;
  baselineAt: Date;
  timestampValid: boolean;
  shouldPersist: boolean;
  recovery: NaturalQiRecoveryProjection;
}

function normalizeInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.floor(value) : fallback;
}

function parseTimestamp(value: Date | string | null | undefined): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return Date.parse(value);
  return Number.NaN;
}

export function projectNaturalQiState(options: {
  qi: number;
  qiLastRefreshedAt: Date | string | null | undefined;
  now: Date;
  max?: number;
  overflowMax?: number;
  restorePerInterval?: number;
  restoreIntervalMs?: number;
}): NaturalQiProjection {
  const nowMs = options.now.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new Error('天地灵气投影需要有效的当前时间');
  }

  const max = Math.max(0, normalizeInteger(options.max ?? QI_MAX, QI_MAX));
  const overflowMax = Math.max(
    max,
    normalizeInteger(options.overflowMax ?? QI_OVERFLOW_MAX, QI_OVERFLOW_MAX),
  );
  const restorePerInterval = Math.max(
    0,
    normalizeInteger(
      options.restorePerInterval ?? QI_NATURAL_RESTORE_PER_INTERVAL,
      QI_NATURAL_RESTORE_PER_INTERVAL,
    ),
  );
  const restoreIntervalMs = Math.max(
    1,
    normalizeInteger(
      options.restoreIntervalMs ?? QI_NATURAL_RESTORE_INTERVAL_MS,
      QI_NATURAL_RESTORE_INTERVAL_MS,
    ),
  );
  const inputQiValid = Number.isFinite(options.qi);
  const normalizedQi = Math.min(
    overflowMax,
    Math.max(0, normalizeInteger(options.qi, 0)),
  );
  const inputQi = normalizeInteger(options.qi, 0);
  const parsedBaselineMs = parseTimestamp(options.qiLastRefreshedAt);
  const timestampValid =
    Number.isFinite(parsedBaselineMs) && parsedBaselineMs <= nowMs;
  const initialBaselineMs = timestampValid ? parsedBaselineMs : nowMs;
  const normalizedInputChanged = !inputQiValid || normalizedQi !== inputQi;

  if (normalizedQi >= max) {
    return {
      current: normalizedQi,
      max,
      restored: 0,
      baselineAt: new Date(nowMs),
      timestampValid,
      shouldPersist:
        normalizedInputChanged || !timestampValid || parsedBaselineMs !== nowMs,
      recovery: {
        status: normalizedQi > max ? 'overflow' : 'full',
        nextRestoreAt: null,
        fullRestoreAt: null,
        nextRestoreInMs: null,
        fullRestoreInMs: null,
      },
    };
  }

  if (!timestampValid) {
    return {
      current: normalizedQi,
      max,
      restored: 0,
      baselineAt: new Date(nowMs),
      timestampValid: false,
      shouldPersist: true,
      recovery: {
        status: 'unknown',
        nextRestoreAt: null,
        fullRestoreAt: null,
        nextRestoreInMs: null,
        fullRestoreInMs: null,
      },
    };
  }

  const elapsedIntervals = Math.floor(
    Math.max(0, nowMs - initialBaselineMs) / restoreIntervalMs,
  );
  const restored = Math.min(
    max - normalizedQi,
    elapsedIntervals * restorePerInterval,
  );
  const current = normalizedQi + restored;
  const baselineMs =
    current >= max
      ? nowMs
      : initialBaselineMs + elapsedIntervals * restoreIntervalMs;

  if (current >= max) {
    return {
      current,
      max,
      restored,
      baselineAt: new Date(baselineMs),
      timestampValid: true,
      shouldPersist: normalizedInputChanged || restored > 0,
      recovery: {
        status: 'full',
        nextRestoreAt: null,
        fullRestoreAt: null,
        nextRestoreInMs: null,
        fullRestoreInMs: null,
      },
    };
  }

  if (restorePerInterval <= 0) {
    return {
      current,
      max,
      restored,
      baselineAt: new Date(baselineMs),
      timestampValid: true,
      shouldPersist: normalizedInputChanged || restored > 0,
      recovery: {
        status: 'unknown',
        nextRestoreAt: null,
        fullRestoreAt: null,
        nextRestoreInMs: null,
        fullRestoreInMs: null,
      },
    };
  }

  const nextRestoreMs = baselineMs + restoreIntervalMs;
  const intervalsToFull = Math.ceil((max - current) / restorePerInterval);
  const fullRestoreMs = baselineMs + intervalsToFull * restoreIntervalMs;

  return {
    current,
    max,
    restored,
    baselineAt: new Date(baselineMs),
    timestampValid: true,
    shouldPersist: normalizedInputChanged || restored > 0,
    recovery: {
      status: 'recovering',
      nextRestoreAt: new Date(nextRestoreMs),
      fullRestoreAt: new Date(fullRestoreMs),
      nextRestoreInMs: Math.max(0, nextRestoreMs - nowMs),
      fullRestoreInMs: Math.max(0, fullRestoreMs - nowMs),
    },
  };
}
