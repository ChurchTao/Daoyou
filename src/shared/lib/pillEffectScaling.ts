import { getPillAppearanceToxicityMultiplier } from '@shared/lib/pillAppearance';
import type { ConditionStatusInstance } from '@shared/types/condition';
import { QUALITY_ORDER, type Quality } from '@shared/types/constants';
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
import { PILL_APPEARANCE_EFFECT_MULTIPLIER } from '@shared/config/alchemyEssenceConfig';

export const BREAKTHROUGH_FOCUS_STATUS_KEY = 'breakthrough_focus' as const;
export const PROTECT_MERIDIANS_STATUS_KEY = 'protect_meridians' as const;
export const CLEAR_MIND_STATUS_KEY = 'clear_mind' as const;

export const LEGACY_BREAKTHROUGH_FOCUS_BONUS = 0.06;
export const LEGACY_PROTECT_MERIDIANS_REDUCTION = 0.4;

const NUMERIC_RULES = {
  restorePercent: { min: 0.08, max: 1 },
  cultivationBoost: { min: 0.3, max: 8 },
  insight: { min: 1, max: 100 },
  lifespan: { min: 10, max: 3000 },
  detox: { min: 10, max: 1000 },
  breakthroughFocus: { min: 0.02, max: 0.3 },
  protectMeridians: { min: 0.15 },
} as const;

export const LIFESPAN_GAIN_BY_QUALITY: Record<Quality, number> = {
  凡品: 10,
  灵品: 25,
  玄品: 50,
  真品: 90,
  地品: 150,
  天品: 600,
  仙品: 1200,
  神品: 2400,
};

export const DETOX_POWER_BY_QUALITY: Record<Quality, number> = {
  凡品: 12,
  灵品: 24,
  玄品: 45,
  真品: 80,
  地品: 140,
  天品: 230,
  仙品: 380,
  神品: 600,
};

export const INSIGHT_GAIN_BY_QUALITY: Record<Quality, number> = {
  凡品: 2,
  灵品: 4,
  玄品: 8,
  真品: 15,
  地品: 26,
  天品: 42,
  仙品: 65,
  神品: 100,
};

export const BREAKTHROUGH_CHANCE_BONUS_BY_QUALITY: Record<Quality, number> = {
  凡品: 0.02,
  灵品: 0.04,
  玄品: 0.07,
  真品: 0.11,
  地品: 0.16,
  天品: 0.21,
  仙品: 0.26,
  神品: 0.3,
};

export const PROTECT_MERIDIANS_REDUCTION_BY_QUALITY: Record<Quality, number> = {
  凡品: 0.15,
  灵品: 0.25,
  玄品: 0.38,
  真品: 0.52,
  地品: 0.66,
  天品: 0.78,
  仙品: 0.88,
  神品: 1,
};

export const BODY_TRACK_ADVANCE_BY_QUALITY: Record<Quality, number> = {
  凡品: 40,
  灵品: 70,
  玄品: 120,
  真品: 200,
  地品: 320,
  天品: 500,
  仙品: 750,
  神品: 1100,
};

export const RESTORE_PERCENT_BY_QUALITY: Record<Quality, number> = {
  凡品: 0.12,
  灵品: 0.2,
  玄品: 0.3,
  真品: 0.42,
  地品: 0.56,
  天品: 0.7,
  仙品: 0.85,
  神品: 1,
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
  return RESTORE_PERCENT_BY_QUALITY[quality];
}

export function buildInsightGain(quality: Quality): number {
  return INSIGHT_GAIN_BY_QUALITY[quality];
}

export function buildLifespanGain(quality: Quality): number {
  return LIFESPAN_GAIN_BY_QUALITY[quality];
}

export function buildDetoxPower(quality: Quality): number {
  return DETOX_POWER_BY_QUALITY[quality];
}

export function buildPositivePillToxicity(quality: Quality): number {
  return 40 - QUALITY_ORDER[quality] * 5;
}

export function buildPillToxicity(
  quality: Quality,
  appearance: PillAppearanceGrade | undefined,
  furnaceMultiplier = 1,
): number {
  if (appearance === 'perfect') return 1;
  const appearanceMultiplier = getPillAppearanceToxicityMultiplier(appearance);
  return Math.max(
    1,
    Math.ceil(buildPositivePillToxicity(quality) * appearanceMultiplier * furnaceMultiplier),
  );
}

export function buildFurnaceToxicityMultiplier(stability: number): number {
  const normalized = Number.isFinite(stability) ? stability : 60;
  return clamp(1 - (normalized - 60) / 200, 0.75, 1.35);
}

export function buildBodyTrackAdvance(quality: Quality): number {
  return BODY_TRACK_ADVANCE_BY_QUALITY[quality];
}

export function buildBreakthroughChanceBonus(quality: Quality): number {
  return BREAKTHROUGH_CHANCE_BONUS_BY_QUALITY[quality];
}

export function buildProtectMeridiansReduction(quality: Quality): number {
  return PROTECT_MERIDIANS_REDUCTION_BY_QUALITY[quality];
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
  return Math.max(NUMERIC_RULES.protectMeridians.min, raw);
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
                ? clamp(value, NUMERIC_RULES.breakthroughFocus.min, NUMERIC_RULES.breakthroughFocus.max)
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
                final ? Math.max(NUMERIC_RULES.protectMeridians.min, value) : value,
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
  const effectMultiplier = PILL_APPEARANCE_EFFECT_MULTIPLIER[appearance];

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
