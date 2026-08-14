import { ALCHEMY_EFFECT_BASE_BY_QUALITY } from '@shared/config/alchemyEffectConfig';
import { getPillAppearanceToxicityMultiplier } from '@shared/lib/pillAppearance';
import type { ConditionStatusInstance } from '@shared/types/condition';
import type { Quality } from '@shared/types/constants';
import type {
  AddStatusOperation,
  PillAppearanceGrade,
} from '@shared/types/consumable';

export const BREAKTHROUGH_FOCUS_STATUS_KEY = 'breakthrough_focus' as const;
export const PROTECT_MERIDIANS_STATUS_KEY = 'protect_meridians' as const;
export const CLEAR_MIND_STATUS_KEY = 'clear_mind' as const;

export const LEGACY_BREAKTHROUGH_FOCUS_BONUS = 0.06;
export const LEGACY_PROTECT_MERIDIANS_REDUCTION = 0.4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

export function buildRestorePercent(quality: Quality): number {
  return ALCHEMY_EFFECT_BASE_BY_QUALITY[quality].restorePercent;
}

export function buildInsightGain(quality: Quality): number {
  return ALCHEMY_EFFECT_BASE_BY_QUALITY[quality].insight;
}

export function buildLifespanGain(quality: Quality): number {
  return ALCHEMY_EFFECT_BASE_BY_QUALITY[quality].lifespan;
}

export function buildDetoxPower(quality: Quality): number {
  return ALCHEMY_EFFECT_BASE_BY_QUALITY[quality].detox;
}

export function buildPositivePillToxicity(quality: Quality): number {
  return ALCHEMY_EFFECT_BASE_BY_QUALITY[quality].positiveToxicity;
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
    Math.ceil(
      buildPositivePillToxicity(quality) *
        appearanceMultiplier *
        furnaceMultiplier,
    ),
  );
}

export function buildFurnaceToxicityMultiplier(stability: number): number {
  const normalized = Number.isFinite(stability) ? stability : 60;
  return clamp(1 - (normalized - 60) / 200, 0.75, 1.35);
}

export function buildBodyTrackAdvance(quality: Quality): number {
  return ALCHEMY_EFFECT_BASE_BY_QUALITY[quality].bodyTrack;
}

export function buildBreakthroughChanceBonus(quality: Quality): number {
  return ALCHEMY_EFFECT_BASE_BY_QUALITY[quality].breakthroughFocus;
}

export function buildProtectMeridiansReduction(quality: Quality): number {
  return ALCHEMY_EFFECT_BASE_BY_QUALITY[quality].protectMeridians;
}

export function buildClearMindUses(
  quality: Quality,
  appearance?: PillAppearanceGrade,
): number {
  const base = ALCHEMY_EFFECT_BASE_BY_QUALITY[quality].clearMindUses;

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
      breakthroughChanceBonus: round4(
        buildBreakthroughChanceBonus(quality) * factor,
      ),
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
  return clamp(raw, 0, 1);
}

export function getProtectMeridiansReductionPercent(
  value: Pick<AddStatusOperation, 'payload'> | ConditionStatusInstance,
): number {
  const raw = value.payload?.failureExpLossReductionPercent;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return LEGACY_PROTECT_MERIDIANS_REDUCTION;
  }
  return clamp(raw, 0, 1);
}
