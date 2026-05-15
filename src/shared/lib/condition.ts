import type {
  ConditionStatusDuration,
  ConditionStatusInstance,
  CultivatorCondition,
} from '@shared/types/condition';

export interface PillToxicityStage {
  key: 'none' | 'light' | 'heavy' | 'critical';
  label: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getDurationExpiresAt(duration: ConditionStatusDuration): number | null {
  if (duration.kind !== 'time') return null;
  const expiresAt = Date.parse(duration.expiresAt);
  return Number.isFinite(expiresAt) ? expiresAt : null;
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

export function getBreakthroughPenalty(
  conditionInput: CultivatorCondition | undefined,
): number {
  const pillToxicity = Math.max(
    0,
    conditionInput?.gauges.pillToxicity ?? 0,
  );
  return clamp(pillToxicity / 1000, 0, 0.18);
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
