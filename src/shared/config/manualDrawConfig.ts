import { type Quality, QUALITY_ORDER } from '@shared/types/constants';
import type { ManualDrawCount, ManualDrawKind } from '@shared/types/manualDraw';

type WeightedQualityMap = Record<Quality, number>;

interface ManualDrawRuleConfig {
  minimumQuality: Quality;
  fiveDrawGuaranteedMinimumQuality: Quality;
  weights: WeightedQualityMap;
}

export const MANUAL_DRAW_RULES = {
  minimumQuality: '灵品' as Quality,
  fiveDrawGuaranteedMinimumQuality: '真品' as Quality,
  fiveDrawCount: 5 as ManualDrawCount,
};

const SHARED_MANUAL_DRAW_WEIGHTS: WeightedQualityMap = {
  凡品: 0,
  灵品: 52,
  玄品: 30,
  真品: 11,
  地品: 4,
  天品: 2,
  仙品: 0.8,
  神品: 0.2,
};

export const MANUAL_DRAW_QUALITY_CONFIG: Record<
  ManualDrawKind,
  ManualDrawRuleConfig
> = {
  gongfa: {
    minimumQuality: MANUAL_DRAW_RULES.minimumQuality,
    fiveDrawGuaranteedMinimumQuality:
      MANUAL_DRAW_RULES.fiveDrawGuaranteedMinimumQuality,
    weights: SHARED_MANUAL_DRAW_WEIGHTS,
  },
  skill: {
    minimumQuality: MANUAL_DRAW_RULES.minimumQuality,
    fiveDrawGuaranteedMinimumQuality:
      MANUAL_DRAW_RULES.fiveDrawGuaranteedMinimumQuality,
    weights: SHARED_MANUAL_DRAW_WEIGHTS,
  },
};

function buildWeightedEntries(
  kind: ManualDrawKind,
  minimumQuality: Quality,
): Array<{ quality: Quality; weight: number }> {
  const config = MANUAL_DRAW_QUALITY_CONFIG[kind];

  return (Object.entries(config.weights) as Array<[Quality, number]>)
    .filter(
      ([quality, weight]) =>
        weight > 0 &&
        QUALITY_ORDER[quality] >= QUALITY_ORDER[minimumQuality],
    )
    .map(([quality, weight]) => ({
      quality,
      weight,
    }));
}

function pickWeightedQuality(
  entries: Array<{ quality: Quality; weight: number }>,
  rng: () => number,
): Quality {
  if (entries.length === 0) {
    throw new Error('问法寻卷品质权重配置为空');
  }

  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    throw new Error('问法寻卷品质权重配置无效');
  }

  let roll = rng() * totalWeight;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry.quality;
    }
  }

  return entries[entries.length - 1].quality;
}

export function rollManualDrawQualities(
  kind: ManualDrawKind,
  count: ManualDrawCount,
  rng: () => number = Math.random,
): Quality[] {
  const config = MANUAL_DRAW_QUALITY_CONFIG[kind];
  const basePool = buildWeightedEntries(kind, config.minimumQuality);
  const qualities = Array.from({ length: count }, () =>
    pickWeightedQuality(basePool, rng),
  );

  if (count !== MANUAL_DRAW_RULES.fiveDrawCount) {
    return qualities;
  }

  const hasGuaranteedTier = qualities.some(
    (quality) =>
      QUALITY_ORDER[quality] >=
      QUALITY_ORDER[config.fiveDrawGuaranteedMinimumQuality],
  );
  if (hasGuaranteedTier) {
    return qualities;
  }

  const guaranteedPool = buildWeightedEntries(
    kind,
    config.fiveDrawGuaranteedMinimumQuality,
  );
  const replaceIndex = Math.floor(rng() * qualities.length);
  qualities[replaceIndex] = pickWeightedQuality(guaranteedPool, rng);

  return qualities;
}
