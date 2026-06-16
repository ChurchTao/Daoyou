import { PILL_EXP_BUDGET } from '@shared/config/pillExpGain';
import { EXP_CAP_TABLE } from '@shared/config/cultivationProgress';
import {
  calculateCultivationExpByCap,
  type CultivationExpCalculationInput,
} from '@shared/lib/cultivationExpGain';
import { QUALITY_ORDER } from '@shared/types/constants';
import type { Quality, RealmStage, RealmType } from '@shared/types/constants';

export interface PillCultivationExpInput {
  realm: RealmType;
  realmStage?: RealmStage;
  expCap?: number;
  quality?: Quality;
  qualityScalar?: number;
  fitMultiplier?: number;
}

function resolvePillExpCap(input: PillCultivationExpInput): number {
  if (
    typeof input.expCap === 'number' &&
    Number.isFinite(input.expCap) &&
    input.expCap > 0
  ) {
    return Math.floor(input.expCap);
  }

  const realmStage = input.realmStage ?? '初期';
  return EXP_CAP_TABLE[input.realm]?.[realmStage] ?? EXP_CAP_TABLE['炼气']['初期'];
}

function resolveQualityPercent(input: PillCultivationExpInput): number {
  const quality = input.quality ?? '凡品';
  const qualityScalar =
    input.qualityScalar ??
    1 + (QUALITY_ORDER[quality] ?? QUALITY_ORDER['凡品']) * 0.22;

  if (input.qualityScalar !== undefined) {
    return (
      PILL_EXP_BUDGET.percentByQuality['凡品'] *
      Math.max(0, Number.isFinite(qualityScalar) ? qualityScalar : 1)
    );
  }

  return (
    PILL_EXP_BUDGET.percentByQuality[quality] ??
    PILL_EXP_BUDGET.percentByQuality['凡品']
  );
}

export function buildPillCultivationExpInput(
  input: PillCultivationExpInput,
): CultivationExpCalculationInput {
  const fitMultiplier =
    typeof input.fitMultiplier === 'number' && Number.isFinite(input.fitMultiplier)
      ? Math.max(0, input.fitMultiplier)
      : 1;

  return {
    cap: resolvePillExpCap(input),
    percent: resolveQualityPercent(input) * fitMultiplier,
    minBaseExp: PILL_EXP_BUDGET.minBaseExp,
  };
}

export function calculatePillCultivationExp(input: PillCultivationExpInput) {
  return calculateCultivationExpByCap(buildPillCultivationExpInput(input));
}
