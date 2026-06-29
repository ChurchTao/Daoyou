import {
  getBreakthroughFocusBonus,
  getProtectMeridiansReductionPercent,
} from '@shared/lib/pillEffectScaling';
import { getCultivationBoostPercent } from '@shared/lib/cultivationBoost';
import { formatScore } from '@shared/lib/scoreFormat';
import type { Quality } from '@shared/types/constants';
import type {
  AddStatusOperation,
  AlchemyBatchProfile,
  ConditionOperation,
  PillAlchemyMeta,
  PillAppearanceGrade,
  PillSpec,
} from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';

const QUALITY_BASE_SCORE: Record<Quality, number> = {
  凡品: 58,
  灵品: 130,
  玄品: 259,
  真品: 504,
  地品: 936,
  天品: 1728,
  仙品: 3096,
  神品: 5472,
};

const EXPECTED_EFFECT_POWER_BY_QUALITY: Record<Quality, number> = {
  凡品: 14,
  灵品: 22,
  玄品: 34,
  真品: 51,
  地品: 76,
  天品: 111,
  仙品: 160,
  神品: 228,
};

const APPEARANCE_SCORE_FACTOR: Record<PillAppearanceGrade, number> = {
  low: 0.92,
  middle: 1,
  high: 1.08,
  perfect: 1.18,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isPillConsumableLike(
  consumable: Pick<Consumable, 'quality' | 'spec'> | null | undefined,
): consumable is Pick<Consumable, 'quality' | 'spec'> & { spec: PillSpec } {
  return consumable?.spec?.kind === 'pill';
}

function getNumericPayloadValue(
  operation: AddStatusOperation,
  key: string,
): number | undefined {
  const value = operation.payload?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function calculateStatusPower(operation: AddStatusOperation): number {
  switch (operation.status) {
    case 'cultivation_boost':
      return getCultivationBoostPercent(operation) * 56;
    case 'breakthrough_focus':
      return getBreakthroughFocusBonus(operation) * 420;
    case 'protect_meridians':
      return getProtectMeridiansReductionPercent(operation) * 80;
    case 'clear_mind':
      return Math.max(1, operation.usesRemaining ?? 1) * 18;
    default: {
      const stacks = Math.max(1, operation.stacks ?? 1);
      const uses = Math.max(1, operation.usesRemaining ?? 1);
      const payloadMagnitude = Object.keys(operation.payload ?? {}).reduce(
        (sum, key) => sum + Math.abs(getNumericPayloadValue(operation, key) ?? 0),
        0,
      );
      return Math.min(36, stacks * uses * 8 + payloadMagnitude * 10);
    }
  }
}

function calculateOperationPower(operation: ConditionOperation): number {
  switch (operation.type) {
    case 'restore_resource':
      return operation.mode === 'percent'
        ? operation.value * 100
        : Math.min(80, operation.value / 20);
    case 'change_gauge':
      return operation.delta < 0 ? Math.abs(operation.delta) * 1.2 : 0;
    case 'advance_track':
      return operation.value * 0.85;
    case 'gain_progress':
      return operation.target === 'comprehension_insight'
        ? operation.value * 2.2
        : Math.sqrt(Math.max(0, operation.value)) * 1.8;
    case 'increase_lifespan':
      return operation.value * 0.45;
    case 'add_status':
      return calculateStatusPower(operation);
    case 'remove_status':
      return operation.removeAll ? 36 : 24;
  }
}

export function calculatePillEffectPower(spec: PillSpec): number {
  return spec.operations.reduce(
    (sum, operation) => sum + calculateOperationPower(operation),
    0,
  );
}

function getFitFactor(meta: PillAlchemyMeta): number {
  if (meta.source !== 'formula') {
    return 1;
  }

  switch (meta.fitBand) {
    case 'aligned':
      return 1 + clamp(meta.fitScore, 0, 1) * 0.03;
    case 'degraded':
      return 0.92;
    case 'poor':
      return 0.82;
  }
}

function getBatchFactor(batch: AlchemyBatchProfile | undefined): number {
  if (!batch) {
    return 1;
  }

  const synergyBonus = clamp(batch.synergyScore, 0, 1) * 0.1;
  const conflictPenalty = clamp(batch.conflictScore, 0, 1) * 0.16;
  return 1 + synergyBonus - conflictPenalty;
}

function calculateCraftFactor(meta: PillAlchemyMeta): number {
  const appearanceFactor = meta.appearance
    ? APPEARANCE_SCORE_FACTOR[meta.appearance]
    : 1;
  const stabilityFactor =
    1 + clamp((meta.stability - 60) / 100, -0.12, 0.16);
  const toxicityFactor =
    1 - clamp(Math.max(0, meta.toxicityRating) * 0.0018, 0, 0.18);

  return (
    appearanceFactor *
    stabilityFactor *
    toxicityFactor *
    getBatchFactor(meta.batch) *
    getFitFactor(meta)
  );
}

export function calculatePillScore(
  consumable: Pick<Consumable, 'quality' | 'spec'> | null | undefined,
): number | null {
  if (!isPillConsumableLike(consumable)) {
    return null;
  }

  const quality = consumable.quality ?? '凡品';
  const qualityBase = QUALITY_BASE_SCORE[quality] ?? QUALITY_BASE_SCORE.凡品;
  const expectedPower =
    EXPECTED_EFFECT_POWER_BY_QUALITY[quality] ??
    EXPECTED_EFFECT_POWER_BY_QUALITY.凡品;
  const effectPower = calculatePillEffectPower(consumable.spec);
  const effectFactor = clamp(0.82 + (effectPower / expectedPower) * 0.18, 0.75, 1.35);
  const craftFactor = calculateCraftFactor(consumable.spec.alchemyMeta);

  return Math.round(clamp(qualityBase * effectFactor * craftFactor, 1, 9999));
}

export function formatPillScore(score: number | null | undefined): string {
  return formatScore(score);
}
