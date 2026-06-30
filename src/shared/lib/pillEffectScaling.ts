import { getLinearQualityValue } from '@shared/lib/pillAppearance';
import type { ConditionStatusInstance } from '@shared/types/condition';
import type { Quality } from '@shared/types/constants';
import type {
  AddStatusOperation,
  ConditionOperation,
  PillAppearanceGrade,
} from '@shared/types/consumable';
import {
  buildCultivationBoostOperation,
  CULTIVATION_BOOST_STATUS_KEY,
  scaleCultivationBoostOperation,
} from './cultivationBoost';

export const BREAKTHROUGH_FOCUS_STATUS_KEY = 'breakthrough_focus' as const;
export const PROTECT_MERIDIANS_STATUS_KEY = 'protect_meridians' as const;
export const CLEAR_MIND_STATUS_KEY = 'clear_mind' as const;

export const LEGACY_BREAKTHROUGH_FOCUS_BONUS = 0.06;
export const LEGACY_PROTECT_MERIDIANS_REDUCTION = 0.4;

const NUMERIC_RULES = {
  restorePercent: { min: 0.08, max: 1 },
  cultivationBoost: { min: 0.3, max: 8 },
  insight: { min: 1, max: 100 },
  lifespan: { min: 10, max: 400 },
  detox: { min: 10, max: 120 },
  breakthroughFocus: { min: 0.02, max: 0.25 },
  protectMeridians: { min: 0.15, max: 1 },
} as const;

export const LIFESPAN_GAIN_BY_QUALITY: Record<Quality, number> = {
  凡品: 10,
  灵品: 37,
  玄品: 64,
  真品: 91,
  地品: 120,
  天品: 155,
  仙品: 240,
  神品: 320,
};

export const DETOX_POWER_BY_QUALITY: Record<Quality, number> = {
  凡品: 10,
  灵品: 17,
  玄品: 24,
  真品: 31,
  地品: 40,
  天品: 52,
  仙品: 85,
  神品: 120,
};

export const BODY_TRACK_ADVANCE_BY_QUALITY: Record<Quality, number> = {
  凡品: 40,
  灵品: 48,
  玄品: 57,
  真品: 66,
  地品: 78,
  天品: 96,
  仙品: 140,
  神品: 210,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function roundInt(value: number): number {
  return Math.max(1, Math.round(value));
}

function floorInt(value: number): number {
  return Math.max(1, Math.floor(value));
}

export function buildRestorePercent(quality: Quality): number {
  return round4(getLinearQualityValue(quality, 0.1, 0.8));
}

export function buildInsightGain(quality: Quality): number {
  return Math.round(getLinearQualityValue(quality, 1, 50));
}

export function buildLifespanGain(quality: Quality): number {
  return LIFESPAN_GAIN_BY_QUALITY[quality];
}

export function buildDetoxPower(quality: Quality): number {
  return DETOX_POWER_BY_QUALITY[quality];
}

export function buildPositivePillToxicity(quality: Quality): number {
  return Math.round(getLinearQualityValue(quality, 3, 40));
}

export function buildBodyTrackAdvance(quality: Quality): number {
  return BODY_TRACK_ADVANCE_BY_QUALITY[quality];
}

export function buildBreakthroughChanceBonus(quality: Quality): number {
  return round4(getLinearQualityValue(quality, 0.02, 0.12));
}

export function buildProtectMeridiansReduction(quality: Quality): number {
  return round4(getLinearQualityValue(quality, 0.2, 0.7));
}

export function buildClearMindUses(
  quality: Quality,
  appearance?: PillAppearanceGrade,
): number {
  const base = (() => {
    switch (quality) {
      case '凡品':
      case '灵品':
        return 1;
      case '玄品':
      case '真品':
      case '地品':
        return 2;
      case '天品':
      case '仙品':
        return 3;
      case '神品':
        return 4;
    }
  })();

  return base + (appearance === 'perfect' ? 1 : 0);
}

export function buildBreakthroughFocusOperation(
  quality: Quality,
  factor = 1,
): AddStatusOperation {
  return {
    type: 'add_status',
    status: BREAKTHROUGH_FOCUS_STATUS_KEY,
    usesRemaining: 1,
    payload: {
      breakthroughChanceBonus: round4(buildBreakthroughChanceBonus(quality) * factor),
    },
  };
}

export function buildProtectMeridiansOperation(
  quality: Quality,
  factor = 1,
): AddStatusOperation {
  return {
    type: 'add_status',
    status: PROTECT_MERIDIANS_STATUS_KEY,
    usesRemaining: 1,
    payload: {
      failureExpLossReductionPercent: round4(
        buildProtectMeridiansReduction(quality) * factor,
      ),
    },
  };
}

export function buildClearMindOperation(quality: Quality): AddStatusOperation {
  return {
    type: 'add_status',
    status: CLEAR_MIND_STATUS_KEY,
    usesRemaining: buildClearMindUses(quality),
    payload: {
      preventsInnerDemon: true,
    },
  };
}

export function getBreakthroughFocusBonus(
  value: Pick<AddStatusOperation, 'payload'> | ConditionStatusInstance,
): number {
  const raw = value.payload?.breakthroughChanceBonus;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return LEGACY_BREAKTHROUGH_FOCUS_BONUS;
  }
  return clamp(raw, NUMERIC_RULES.breakthroughFocus.min, NUMERIC_RULES.breakthroughFocus.max);
}

export function getProtectMeridiansReductionPercent(
  value: Pick<AddStatusOperation, 'payload'> | ConditionStatusInstance,
): number {
  const raw = value.payload?.failureExpLossReductionPercent;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return LEGACY_PROTECT_MERIDIANS_REDUCTION;
  }
  return clamp(raw, NUMERIC_RULES.protectMeridians.min, NUMERIC_RULES.protectMeridians.max);
}

export function scalePillEffectOperation(
  operation: ConditionOperation,
  factor: number,
  options: { final?: boolean } = {},
): ConditionOperation {
  const final = options.final ?? false;

  switch (operation.type) {
    case 'restore_resource': {
      const value =
        operation.mode === 'percent'
          ? round4(operation.value * factor)
          : floorInt(operation.value * factor);
      return {
        ...operation,
        value:
          final && operation.mode === 'percent'
            ? round4(clamp(value, NUMERIC_RULES.restorePercent.min, NUMERIC_RULES.restorePercent.max))
            : value,
      };
    }
    case 'advance_track':
      return {
        ...operation,
        value: floorInt(operation.value * factor),
      };
    case 'gain_progress': {
      const value = floorInt(operation.value * factor);
      return {
        ...operation,
        value:
          final && operation.target === 'comprehension_insight'
            ? clamp(value, NUMERIC_RULES.insight.min, NUMERIC_RULES.insight.max)
            : value,
      };
    }
    case 'increase_lifespan': {
      const value = floorInt(operation.value * factor);
      return {
        ...operation,
        value: final
          ? clamp(value, NUMERIC_RULES.lifespan.min, NUMERIC_RULES.lifespan.max)
          : value,
      };
    }
    case 'change_gauge': {
      if (operation.delta >= 0) {
        return operation;
      }
      const value = roundInt(Math.abs(operation.delta) * factor);
      return {
        ...operation,
        delta: -(
          final
            ? clamp(value, NUMERIC_RULES.detox.min, NUMERIC_RULES.detox.max)
            : value
        ),
      };
    }
    case 'add_status': {
      if (operation.status === CULTIVATION_BOOST_STATUS_KEY) {
        return scaleCultivationBoostOperation(operation, factor);
      }
      if (operation.status === BREAKTHROUGH_FOCUS_STATUS_KEY) {
        const value = getBreakthroughFocusBonus(operation) * factor;
        return {
          ...operation,
          payload: {
            ...operation.payload,
            breakthroughChanceBonus: round4(
              final
                ? clamp(
                    value,
                    NUMERIC_RULES.breakthroughFocus.min,
                    NUMERIC_RULES.breakthroughFocus.max,
                  )
                : value,
            ),
          },
        };
      }
      if (operation.status === PROTECT_MERIDIANS_STATUS_KEY) {
        const value = getProtectMeridiansReductionPercent(operation) * factor;
        return {
          ...operation,
          payload: {
            ...operation.payload,
            failureExpLossReductionPercent: round4(
              final
                ? clamp(
                    value,
                    NUMERIC_RULES.protectMeridians.min,
                    NUMERIC_RULES.protectMeridians.max,
                  )
                : value,
            ),
          },
        };
      }
      return operation;
    }
    default:
      return operation;
  }
}

export function applyPillAppearanceToOperations(
  operations: ConditionOperation[],
  appearance: PillAppearanceGrade,
): ConditionOperation[] {
  const effectMultiplier =
    appearance === 'low'
      ? 0.75
      : appearance === 'middle'
        ? 1
        : appearance === 'high'
          ? 1.25
          : 1.8;

  return operations.map((operation) => {
    if (
      operation.type === 'add_status' &&
      operation.status === CLEAR_MIND_STATUS_KEY
    ) {
      return {
        ...operation,
        usesRemaining:
          appearance === 'perfect'
            ? (operation.usesRemaining ?? 1) + 1
            : operation.usesRemaining,
      };
    }
    return scalePillEffectOperation(operation, effectMultiplier, {
      final: true,
    });
  });
}

export function buildCultivationBoostOperationV2(
  quality: Quality,
  factor = 1,
): AddStatusOperation {
  return buildCultivationBoostOperation(quality, factor);
}
