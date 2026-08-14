import {
  MATERIAL_ESSENCE_BY_QUALITY,
  MATERIAL_ESSENCE_TYPE_MULTIPLIER,
  MAX_ALCHEMY_EFFECTIVE_ESSENCE_MULTIPLIER,
  MAX_ALCHEMY_OUTPUT_LOTS,
  MAX_ALCHEMY_OUTPUT_QUANTITY,
  PILL_APPEARANCE_EFFECT_MULTIPLIER,
  PILL_CONDENSATION_MULTIPLIER_BY_QUALITY,
  PILL_UNIT_ESSENCE_BY_QUALITY,
} from '@shared/config/alchemyEssenceConfig';
import { QUALITY_ORDER, QUALITY_VALUES, type Quality } from '@shared/types/constants';
import type {
  AlchemyOutputLot,
  AlchemyYieldProfile,
  AlchemyYieldDisplayProfile,
  PillAppearanceGrade,
} from '@shared/types/consumable';

export interface AlchemyEssenceMaterial {
  rank: Quality;
  type?: string;
  dose: number;
}

export function toAlchemyYieldDisplayProfile(
  profile: AlchemyYieldProfile,
): AlchemyYieldDisplayProfile {
  return {
    primaryQuality: profile.primaryQuality,
    lots: profile.lots.map(({ quality, appearance, quantity, effectMultiplier }) => ({
      quality,
      appearance,
      quantity,
      effectMultiplier,
    })),
    totalQuantity: profile.totalQuantity,
    essenceLossRatio: profile.essenceLossRatio ?? 0,
    distributionSummary: profile.distributionSummary,
  };
}

export interface AlchemyYieldFactors {
  synergyScore?: number;
  conflictScore?: number;
  fitMultiplier?: number;
  stability?: number;
  purity?: number;
  masteryLevel?: number;
  focusMode?: 'focused' | 'balanced' | 'risky';
  minQuality?: Quality;
}

const APPEARANCE_ORDER: PillAppearanceGrade[] = [
  'perfect',
  'high',
  'middle',
  'low',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeRoll(rng: () => number): number {
  const value = rng();
  return clamp(Number.isFinite(value) ? value : 0.5, 0, 0.999999);
}

export function calculateRawEssence(materials: AlchemyEssenceMaterial[]): number {
  return Math.max(
    0,
    Math.round(
      materials.reduce((sum, material) => {
        const dose = Math.max(0, Math.floor(material.dose));
        const qualityEssence = MATERIAL_ESSENCE_BY_QUALITY[material.rank] ?? 0;
        const typeMultiplier = MATERIAL_ESSENCE_TYPE_MULTIPLIER[material.type ?? 'herb'] ?? 1;
        return sum + dose * qualityEssence * typeMultiplier;
      }, 0),
    ),
  );
}

/** 每 200 点原始药蕴消耗 1 点天地灵气，单炉限制在 1～20 点。 */
export function calculateAlchemyQiCost(
  materials: AlchemyEssenceMaterial[],
): number {
  const rawEssence = calculateRawEssence(materials);
  return Math.min(20, Math.max(1, Math.ceil(rawEssence / 200)));
}

export function calculateEffectiveEssence(
  rawEssence: number,
  factors: AlchemyYieldFactors = {},
): number {
  const synergy = clamp(factors.synergyScore ?? 0, 0, 1);
  const conflict = clamp(factors.conflictScore ?? 0, 0, 1);
  const stability = clamp((factors.stability ?? 60) / 100, 0, 1);
  const fit = clamp(factors.fitMultiplier ?? 1, 0.85, 1.15);
  const mastery = clamp((factors.masteryLevel ?? 0) * 0.01, 0, 0.15);
  const focus = factors.focusMode === 'focused' ? 0.04 : factors.focusMode === 'risky' ? 0.06 : 0.02;
  const multiplier = clamp(
    0.78 + synergy * 0.16 - conflict * 0.2 + stability * 0.12 + mastery + focus + (fit - 1) * 0.35,
    0.5,
    MAX_ALCHEMY_EFFECTIVE_ESSENCE_MULTIPLIER,
  );
  return Math.max(1, Math.floor(Math.min(rawEssence * multiplier, 2_000_000)));
}

export function calculateQualityPotential(
  materials: AlchemyEssenceMaterial[],
  factors: AlchemyYieldFactors = {},
): number {
  const rawEssence = calculateRawEssence(materials);
  if (rawEssence <= 0) return 0;
  const weighted = materials.reduce((sum, material) => {
    const essence =
      Math.max(0, material.dose) *
      (MATERIAL_ESSENCE_BY_QUALITY[material.rank] ?? 0) *
      (MATERIAL_ESSENCE_TYPE_MULTIPLIER[material.type ?? 'herb'] ?? 1);
    return sum + essence * QUALITY_ORDER[material.rank];
  }, 0);
  const averageOrder = weighted / rawEssence;
  const quality = clamp(
    (averageOrder - 1) / 7 +
      clamp(factors.synergyScore ?? 0, 0, 1) * 0.08 -
      clamp(factors.conflictScore ?? 0, 0, 1) * 0.12 +
      clamp((factors.stability ?? 60) / 100, 0, 1) * 0.08 +
      clamp((factors.masteryLevel ?? 0) * 0.01, 0, 0.12),
    0,
    1,
  );
  return Number(quality.toFixed(4));
}

export interface AlchemyQualityEssenceBucket {
  quality: Quality;
  rawEssence: number;
  effectiveEssence: number;
  share: number;
  unitEssence: number;
}

export function calculateEssenceBuckets(
  materials: AlchemyEssenceMaterial[],
): AlchemyQualityEssenceBucket[] {
  const rawByQuality = new Map<Quality, number>(
    QUALITY_VALUES.map((quality) => [quality, 0]),
  );
  for (const material of materials) {
    const dose = Math.max(0, Math.floor(material.dose));
    const essence =
      dose *
      (MATERIAL_ESSENCE_BY_QUALITY[material.rank] ?? 0) *
      (MATERIAL_ESSENCE_TYPE_MULTIPLIER[material.type ?? 'herb'] ?? 1);
    rawByQuality.set(
      material.rank,
      (rawByQuality.get(material.rank) ?? 0) + essence,
    );
  }
  const total = [...rawByQuality.values()].reduce((sum, value) => sum + value, 0);
  return QUALITY_VALUES.map((quality) => {
    const rawEssence = Math.round(rawByQuality.get(quality) ?? 0);
    return {
      quality,
      rawEssence,
      effectiveEssence: 0,
      share: total > 0 ? rawEssence / total : 0,
      unitEssence: PILL_UNIT_ESSENCE_BY_QUALITY[quality],
    };
  });
}

function primaryQualityFromLots(lots: AlchemyOutputLot[], fallback: Quality): Quality {
  return lots.reduce(
    (best, lot) =>
      QUALITY_ORDER[lot.quality] > QUALITY_ORDER[best] ? lot.quality : best,
    fallback,
  );
}

function buildAppearanceProfile(
  purity: number,
  stability: number,
  masteryLevel: number,
  rng: () => number,
): {
  primary: PillAppearanceGrade;
  secondary?: PillAppearanceGrade;
  secondaryShare: number;
  boundaryDistance: number;
} {
  const score = clamp(
    normalizeRoll(rng) +
      (purity - 0.5) * 0.35 +
      (stability - 60) / 300 +
      clamp(masteryLevel * 0.01, 0, 0.12),
    0,
    0.999999,
  );
  if (score >= 0.96) {
    return { primary: 'perfect', secondaryShare: 0, boundaryDistance: score - 0.96 };
  }
  if (score >= 0.72) {
    return {
      primary: 'high',
      secondary: 'middle',
      secondaryShare: Number(((0.96 - score) / 0.24).toFixed(4)),
      boundaryDistance: Math.min(score - 0.72, 0.96 - score),
    };
  }
  if (score >= 0.3) {
    return {
      primary: 'middle',
      secondary: 'low',
      secondaryShare: Number(((0.72 - score) / 0.42).toFixed(4)),
      boundaryDistance: Math.min(score - 0.3, 0.72 - score),
    };
  }
  return { primary: 'low', secondaryShare: 0, boundaryDistance: score };
}

function addLot(
  lots: AlchemyOutputLot[],
  quality: Quality,
  appearance: PillAppearanceGrade,
  quantity: number,
  essenceSpent: number,
): void {
  if (quantity <= 0) return;
  const existing = lots.find(
    (lot) => lot.quality === quality && lot.appearance === appearance,
  );
  const effectMultiplier = Number(
    (PILL_CONDENSATION_MULTIPLIER_BY_QUALITY[quality] *
      PILL_APPEARANCE_EFFECT_MULTIPLIER[appearance]).toFixed(4),
  );
  if (existing) {
    existing.quantity = Math.min(MAX_ALCHEMY_OUTPUT_QUANTITY, existing.quantity + quantity);
    existing.essenceSpent += essenceSpent;
  } else {
    lots.push({ quality, appearance, quantity, essenceSpent, effectMultiplier });
  }
}

function capOutputQuantity(lots: AlchemyOutputLot[]): void {
  let overflow = lots.reduce((sum, lot) => sum + lot.quantity, 0) - MAX_ALCHEMY_OUTPUT_QUANTITY;
  if (overflow <= 0) return;
  for (let index = lots.length - 1; index >= 0 && overflow > 0; index -= 1) {
    const lot = lots[index];
    const removed = Math.min(lot.quantity, overflow);
    lot.quantity -= removed;
    lot.essenceSpent -= removed * PILL_UNIT_ESSENCE_BY_QUALITY[lot.quality];
    overflow -= removed;
  }
  for (let index = lots.length - 1; index >= 0; index -= 1) {
    if (lots[index].quantity <= 0) lots.splice(index, 1);
  }
}

function calculateRemainderConversionRate(factors: AlchemyYieldFactors): number {
  const stability = clamp(factors.stability ?? 60, 0, 100);
  const synergy = clamp(factors.synergyScore ?? 0, 0, 1);
  const conflict = clamp(factors.conflictScore ?? 0, 0, 1);
  const mastery = clamp(factors.masteryLevel ?? 0, 0, 20);
  const focusModifier = factors.focusMode === 'focused'
    ? 0.03
    : factors.focusMode === 'risky'
      ? -0.05
      : 0;
  return clamp(
    0.7 + stability / 500 + synergy * 0.06 - conflict * 0.1 + mastery * 0.005 + focusModifier,
    0.65,
    0.9,
  );
}

interface YieldQualityGroup {
  quality: Quality;
  quantity: number;
  unitEssence: number;
  appearance: ReturnType<typeof buildAppearanceProfile>;
}

export function rollAlchemyYieldProfile(options: {
  materials: AlchemyEssenceMaterial[];
  factors?: AlchemyYieldFactors;
  rng?: () => number;
}): AlchemyYieldProfile {
  const factors = options.factors ?? {};
  const rng = options.rng ?? Math.random;
  const rawEssence = calculateRawEssence(options.materials);
  const effectiveEssence = calculateEffectiveEssence(rawEssence, factors);
  const qualityPotential = calculateQualityPotential(options.materials, factors);
  const stability = clamp(factors.stability ?? 60, 0, 100);
  const purity = clamp(
    factors.purity ?? 0.5 + qualityPotential * 0.35 + stability / 500,
    0.1,
    0.98,
  );
  const minimumOrder = factors.minQuality ? QUALITY_ORDER[factors.minQuality] : 0;
  const buckets = calculateEssenceBuckets(options.materials);
  const pools = buckets.map((bucket) => ({
    ...bucket,
    effectiveEssence: bucket.share * effectiveEssence,
  }));
  const canFormNativePill = pools.some(
    (pool) => QUALITY_ORDER[pool.quality] >= minimumOrder && pool.effectiveEssence >= pool.unitEssence,
  );
  const lots: AlchemyOutputLot[] = [];
  if (!canFormNativePill) {
    return {
      essence: {
        rawEssence,
        effectiveEssence,
        qualityPotential,
        purity: Number(purity.toFixed(4)),
        stability,
      },
      primaryQuality: factors.minQuality ?? '凡品',
      lots,
      totalQuantity: 0,
      wastedEssence: effectiveEssence,
      essenceLossRatio: effectiveEssence > 0 ? 1 : 0,
      distributionSummary: '',
    };
  }

  const conversionRate = calculateRemainderConversionRate(factors);
  const incomingDegraded = new Map<Quality, number>();
  const groups = new Map<Quality, number>();

  for (let order = QUALITY_VALUES.length - 1; order >= minimumOrder; order -= 1) {
    const bucket = pools[order];
    if (!bucket || QUALITY_ORDER[bucket.quality] < minimumOrder) continue;
    const nativeQuantity = Math.floor(bucket.effectiveEssence / bucket.unitEssence);
    const nativeRemainder = bucket.effectiveEssence - nativeQuantity * bucket.unitEssence;
    if (nativeQuantity > 0) {
      groups.set(bucket.quality, (groups.get(bucket.quality) ?? 0) + nativeQuantity);
    }
    const incoming = incomingDegraded.get(bucket.quality) ?? 0;
    const combined = nativeRemainder + incoming;
    const supplementalQuantity = Math.floor(combined / bucket.unitEssence);
    if (supplementalQuantity > 0) {
      groups.set(bucket.quality, (groups.get(bucket.quality) ?? 0) + supplementalQuantity);
    }

    if (order > minimumOrder) {
      const nativeRemainderUsed = Math.max(0, supplementalQuantity * bucket.unitEssence - incoming);
      const convertibleNativeRemainder = Math.max(0, nativeRemainder - nativeRemainderUsed);
      const target = QUALITY_VALUES[order - 1];
      incomingDegraded.set(
        target,
        (incomingDegraded.get(target) ?? 0) + Math.floor(convertibleNativeRemainder * conversionRate),
      );
    }
  }

  const qualityGroups: YieldQualityGroup[] = [...groups.entries()]
    .filter(([, quantity]) => quantity > 0)
    .sort(([left], [right]) => QUALITY_ORDER[right] - QUALITY_ORDER[left])
    .map(([quality, quantity]) => ({
      quality,
      quantity: Math.min(MAX_ALCHEMY_OUTPUT_QUANTITY, quantity),
      unitEssence: PILL_UNIT_ESSENCE_BY_QUALITY[quality],
      appearance: buildAppearanceProfile(
        purity,
        stability,
        factors.masteryLevel ?? 0,
        rng,
      ),
    }));
  const remainingSlots = Math.max(0, MAX_ALCHEMY_OUTPUT_LOTS - qualityGroups.length);
  const splitGroups = new Set(
    qualityGroups
      .map((group, index) => ({ group, index }))
      .filter(({ group }) => group.quantity > 1 && group.appearance.secondary)
      .sort((left, right) =>
        right.group.quantity - left.group.quantity ||
        right.group.quantity * right.group.unitEssence - left.group.quantity * left.group.unitEssence ||
        left.group.appearance.boundaryDistance - right.group.appearance.boundaryDistance,
      )
      .slice(0, remainingSlots)
      .map(({ index }) => index),
  );

  for (const [index, group] of qualityGroups.entries()) {
    const shouldSplit = splitGroups.has(index) && group.appearance.secondary;
    const secondaryQuantity = shouldSplit
      ? Math.max(1, Math.min(group.quantity - 1, Math.round(group.quantity * group.appearance.secondaryShare)))
      : 0;
    const primaryQuantity = group.quantity - secondaryQuantity;
    addLot(lots, group.quality, group.appearance.primary, primaryQuantity, primaryQuantity * group.unitEssence);
    if (secondaryQuantity > 0 && group.appearance.secondary) {
      addLot(lots, group.quality, group.appearance.secondary, secondaryQuantity, secondaryQuantity * group.unitEssence);
    }
  }

  const orderedLots = lots.sort(
    (left, right) => QUALITY_ORDER[right.quality] - QUALITY_ORDER[left.quality] ||
      APPEARANCE_ORDER.indexOf(left.appearance) - APPEARANCE_ORDER.indexOf(right.appearance),
  );
  capOutputQuantity(orderedLots);
  const spentAfterLotCap = orderedLots.reduce((sum, lot) => sum + lot.essenceSpent, 0);
  const totalQuantity = orderedLots.reduce((sum, lot) => sum + lot.quantity, 0);
  const primaryQuality = primaryQualityFromLots(orderedLots, factors.minQuality ?? '凡品');
  return {
    essence: {
      rawEssence,
      effectiveEssence,
      qualityPotential,
      purity: Number(purity.toFixed(4)),
      stability,
    },
    primaryQuality,
    lots: orderedLots,
    totalQuantity,
    wastedEssence: Math.max(0, Math.round(effectiveEssence - spentAfterLotCap)),
    essenceLossRatio: effectiveEssence > 0
      ? clamp(
          Number(
            ((effectiveEssence - spentAfterLotCap) / effectiveEssence).toFixed(4),
          ),
          0,
          1,
        )
      : 0,
    distributionSummary: orderedLots.map((lot) => `${lot.quality}/${lot.appearance}×${lot.quantity}`).join('、'),
  };
}

export function buildAlchemyYieldPreview(options: {
  materials: AlchemyEssenceMaterial[];
  factors?: AlchemyYieldFactors;
}): Pick<AlchemyYieldProfile, 'essence' | 'primaryQuality'> & {
  totalQuantityRange: { min: number; max: number };
  primaryQualityRange: { min: Quality; max: Quality };
  possibleQualities: Quality[];
  possibleAppearances: PillAppearanceGrade[];
  appearanceHints: Partial<Record<PillAppearanceGrade, number>>;
  essenceLossRatioRange: { min: number; max: number };
  likelyLots: Array<{
    quality: Quality;
    minQuantity: number;
    maxQuantity: number;
    possibleAppearances: PillAppearanceGrade[];
  }>;
} {
  const factors = options.factors ?? {};
  const rawEssence = calculateRawEssence(options.materials);
  const effectiveEssence = calculateEffectiveEssence(rawEssence, factors);
  const qualityPotential = calculateQualityPotential(options.materials, factors);
  const purity = Number(
    clamp(
      factors.purity ?? 0.5 + qualityPotential * 0.35,
      0.1,
      0.98,
    ).toFixed(4),
  );
  const stability = clamp(factors.stability ?? 60, 0, 100);

  // 预览和确认共用 rollAlchemyYieldProfile；这里仅用固定种子做区间模拟，
  // 不向客户端暴露确定结果，也不消耗服务端正式随机源。
  const seeds = [0.07, 0.19, 0.31, 0.43, 0.57, 0.69, 0.81, 0.93];
  const simulations = seeds.map((seed) => {
    let state = Math.floor(seed * 0x7fffffff) || 1;
    const rng = () => {
      state = (state * 48271) % 0x7fffffff;
      return state / 0x7fffffff;
    };
    return rollAlchemyYieldProfile({
      materials: options.materials,
      factors,
      rng,
    });
  });

  const nonEmpty = simulations.filter((simulation) => simulation.totalQuantity > 0);
  const samples = nonEmpty.length > 0 ? nonEmpty : simulations;
  const totalQuantities = samples.map((simulation) => simulation.totalQuantity);
  const primaryQualities = samples.map((simulation) => simulation.primaryQuality);
  const possibleQualitySet = new Set<Quality>();
  const appearanceSet = new Set<PillAppearanceGrade>();
  const appearanceCounts: Record<PillAppearanceGrade, number> = {
    low: 0,
    middle: 0,
    high: 0,
    perfect: 0,
  };
  const lotStats = new Map<Quality, {
    minQuantity: number;
    maxQuantity: number;
    appearances: Set<PillAppearanceGrade>;
  }>();

  for (const simulation of samples) {
    for (const lot of simulation.lots) {
      possibleQualitySet.add(lot.quality);
      appearanceSet.add(lot.appearance);
      appearanceCounts[lot.appearance] += lot.quantity;
      const current = lotStats.get(lot.quality) ?? {
        minQuantity: 0,
        maxQuantity: 0,
        appearances: new Set<PillAppearanceGrade>(),
      };
      current.minQuantity = current.minQuantity === 0
        ? lot.quantity
        : Math.min(current.minQuantity, lot.quantity);
      current.maxQuantity = Math.max(current.maxQuantity, lot.quantity);
      current.appearances.add(lot.appearance);
      lotStats.set(lot.quality, current);
    }
  }

  const sortedQualities = [...possibleQualitySet].sort(
    (left, right) => QUALITY_ORDER[right] - QUALITY_ORDER[left],
  );
  const minPrimary = primaryQualities.reduce(
    (lowest, quality) => QUALITY_ORDER[quality] < QUALITY_ORDER[lowest] ? quality : lowest,
    primaryQualities[0] ?? factors.minQuality ?? '凡品',
  );
  const maxPrimary = primaryQualities.reduce(
    (highest, quality) => QUALITY_ORDER[quality] > QUALITY_ORDER[highest] ? quality : highest,
    primaryQualities[0] ?? factors.minQuality ?? '凡品',
  );
  const appearanceTotal = Object.values(appearanceCounts).reduce((sum, count) => sum + count, 0);
  const appearanceHints = Object.fromEntries(
    APPEARANCE_ORDER
      .filter((appearance) => appearanceTotal > 0 && appearanceCounts[appearance] > 0)
      .map((appearance) => [appearance, Number((appearanceCounts[appearance] / appearanceTotal).toFixed(4))]),
  ) as Partial<Record<PillAppearanceGrade, number>>;
  const lossRatios = samples.map((simulation) => simulation.essenceLossRatio ?? 0);

  return {
    essence: { rawEssence, effectiveEssence, qualityPotential, purity, stability },
    primaryQuality: maxPrimary,
    totalQuantityRange: {
      min: Math.min(...totalQuantities),
      max: Math.max(...totalQuantities),
    },
    primaryQualityRange: { min: minPrimary, max: maxPrimary },
    possibleQualities: sortedQualities,
    possibleAppearances: [...appearanceSet].sort(
      (left, right) => APPEARANCE_ORDER.indexOf(left) - APPEARANCE_ORDER.indexOf(right),
    ),
    appearanceHints,
    essenceLossRatioRange: {
      min: Number(Math.min(...lossRatios).toFixed(4)),
      max: Number(Math.max(...lossRatios).toFixed(4)),
    },
    likelyLots: sortedQualities.map((quality) => {
      const stat = lotStats.get(quality);
      return {
        quality,
        minQuantity: stat?.minQuantity ?? 0,
        maxQuantity: stat?.maxQuantity ?? 0,
        possibleAppearances: stat
          ? [...stat.appearances].sort(
              (left, right) => APPEARANCE_ORDER.indexOf(left) - APPEARANCE_ORDER.indexOf(right),
            )
          : [],
      };
    }),
  };
}
