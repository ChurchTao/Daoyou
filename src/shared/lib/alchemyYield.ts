import {
  MATERIAL_ESSENCE_BY_QUALITY,
  MATERIAL_ESSENCE_TYPE_MULTIPLIER,
  MAX_ALCHEMY_OUTPUT_LOTS,
  MAX_ALCHEMY_OUTPUT_QUANTITY,
  PILL_APPEARANCE_EFFECT_MULTIPLIER,
  PILL_CONDENSATION_MULTIPLIER_BY_QUALITY,
  PILL_UNIT_ESSENCE_BY_QUALITY,
} from '@shared/config/alchemyEssenceConfig';
import { QUALITY_ORDER, QUALITY_VALUES, type Quality } from '@shared/types/constants';
import { getPillAppearanceToxicityMultiplier } from '@shared/lib/pillAppearance';
import type {
  AlchemyOutputLot,
  AlchemyYieldProfile,
  AlchemyYieldDisplayProfile,
  PillAppearanceGrade,
} from '@shared/types/consumable';
import type { ConditionOperation } from '@shared/types/consumable';
import { buildPositivePillToxicity, scalePillEffectOperation } from './pillEffectScaling';

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
    1.2,
  );
  return Math.max(1, Math.round(Math.min(rawEssence * multiplier, 2_000_000)));
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

function deriveMigrationRates(factors: AlchemyYieldFactors): {
  upward: number;
  downward: number;
} {
  const stability = clamp(factors.stability ?? 60, 0, 100);
  const synergy = clamp(factors.synergyScore ?? 0, 0, 1);
  const conflict = clamp(factors.conflictScore ?? 0, 0, 1);
  const fit = clamp(factors.fitMultiplier ?? 1, 0.85, 1.15);
  const upward = clamp(
    0.04 + stability / 1000 + synergy * 0.06 + (fit - 1) * 0.2 +
      clamp((factors.masteryLevel ?? 0) * 0.001, 0, 0.03) - conflict * 0.05,
    0,
    0.16,
  );
  const downward = clamp(
    conflict * 0.12 + Math.max(0, 50 - stability) / 500,
    0,
    0.16,
  );
  return { upward, downward };
}

/** 将药蕴只在相邻品质间有限迁移，避免平均品质抬高整炉。 */
export function applyQualityEssenceMigration(
  buckets: AlchemyQualityEssenceBucket[],
  factors: AlchemyYieldFactors = {},
  effectiveEssence: number,
): AlchemyQualityEssenceBucket[] {
  const migrated = buckets.map((bucket) => ({ ...bucket, effectiveEssence: bucket.share * effectiveEssence }));
  const { upward, downward } = deriveMigrationRates(factors);
  if (upward > downward) {
    const rate = upward - downward;
    const snapshot = migrated.map((bucket) => bucket.effectiveEssence);
    const transfers = new Map<Quality, number>();
    for (let order = 0; order < QUALITY_VALUES.length - 1; order += 1) {
      const source = migrated[order];
      const target = migrated[order + 1];
      const transfer = Math.min(snapshot[order] * rate, snapshot[order]);
      transfers.set(source.quality, (transfers.get(source.quality) ?? 0) - transfer);
      transfers.set(target.quality, (transfers.get(target.quality) ?? 0) + transfer);
    }
    for (const bucket of migrated) bucket.effectiveEssence += transfers.get(bucket.quality) ?? 0;
  } else if (downward > upward) {
    const rate = downward - upward;
    const snapshot = migrated.map((bucket) => bucket.effectiveEssence);
    const transfers = new Map<Quality, number>();
    for (let order = QUALITY_VALUES.length - 1; order > 0; order -= 1) {
      const source = migrated[order];
      const target = migrated[order - 1];
      const transfer = Math.min(snapshot[order] * rate, snapshot[order]);
      transfers.set(source.quality, (transfers.get(source.quality) ?? 0) - transfer);
      transfers.set(target.quality, (transfers.get(target.quality) ?? 0) + transfer);
    }
    for (const bucket of migrated) bucket.effectiveEssence += transfers.get(bucket.quality) ?? 0;
  }
  const total = migrated.reduce((sum, bucket) => sum + bucket.effectiveEssence, 0);
  for (const bucket of migrated) {
    bucket.effectiveEssence = Math.max(0, bucket.effectiveEssence);
    bucket.share = total > 0 ? bucket.effectiveEssence / total : 0;
  }
  return migrated;
}

function qualityFromPotential(potential: number): Quality {
  const order = clamp(
    Math.floor(potential * QUALITY_VALUES.length),
    0,
    QUALITY_VALUES.length - 1,
  );
  return QUALITY_VALUES[order] ?? '凡品';
}

function primaryQualityFromLots(lots: AlchemyOutputLot[], fallback: Quality): Quality {
  return lots.reduce(
    (best, lot) =>
      QUALITY_ORDER[lot.quality] > QUALITY_ORDER[best] ? lot.quality : best,
    fallback,
  );
}

function buildAppearance(
  purity: number,
  stability: number,
  masteryLevel: number,
  rng: () => number,
): PillAppearanceGrade {
  const score = clamp(
    normalizeRoll(rng) +
      (purity - 0.5) * 0.35 +
      (stability - 60) / 300 +
      clamp(masteryLevel * 0.01, 0, 0.12),
    0,
    0.999999,
  );
  if (score >= 0.96) return 'perfect';
  if (score >= 0.72) return 'high';
  if (score >= 0.3) return 'middle';
  return 'low';
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
  const buckets = applyQualityEssenceMigration(
    calculateEssenceBuckets(options.materials),
    factors,
    effectiveEssence,
  );
  const minimumOrder = factors.minQuality ? QUALITY_ORDER[factors.minQuality] : 0;
  const lots: AlchemyOutputLot[] = [];

  for (let order = QUALITY_VALUES.length - 1; order >= minimumOrder; order -= 1) {
    const bucket = buckets[order];
    if (!bucket || bucket.effectiveEssence < bucket.unitEssence) continue;
    // 随机只影响本品质实际投入的药蕴预算，不能凭空增加超过药蕴可支撑的数量。
    const budget = bucket.effectiveEssence * (0.9 + normalizeRoll(rng) * 0.1);
    const quantity = Math.floor(budget / bucket.unitEssence);
    if (quantity <= 0) continue;
    const spent = quantity * bucket.unitEssence;
    const appearanceCounts: Record<PillAppearanceGrade, number> = {
      low: 0,
      middle: 0,
      high: 0,
      perfect: 0,
    };
    for (let index = 0; index < quantity; index += 1) {
      appearanceCounts[buildAppearance(purity, stability, factors.masteryLevel ?? 0, rng)] += 1;
    }
    const appearances = APPEARANCE_ORDER
      .map((appearance) => ({ appearance, count: appearanceCounts[appearance] }))
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.count - left.count);
    // 每个品质最多保留两个品相，第三种及以后视为凝练损耗，避免错误合并不同药效。
    for (const entry of appearances.slice(0, 2)) {
      addLot(
        lots,
        bucket.quality,
        entry.appearance,
        entry.count,
        Math.round((spent * entry.count) / quantity),
      );
    }
  }

  if (lots.length === 0) {
    const fallback = factors.minQuality ?? '凡品';
    const quantity = 1;
    const spent = Math.min(effectiveEssence, PILL_UNIT_ESSENCE_BY_QUALITY[fallback]);
    addLot(lots, fallback, buildAppearance(purity, stability, factors.masteryLevel ?? 0, rng), quantity, spent);
  }

  // 只保留药蕴/数量贡献最高的 8 个批次；被裁剪批次计入损耗，不改变其他批次药效。
  const boundedLots = lots
    .sort((left, right) => right.essenceSpent - left.essenceSpent || QUALITY_ORDER[right.quality] - QUALITY_ORDER[left.quality])
    .slice(0, MAX_ALCHEMY_OUTPUT_LOTS);
  const spentAfterLotCap = boundedLots.reduce((sum, lot) => sum + lot.essenceSpent, 0);
  const totalQuantity = boundedLots.reduce((sum, lot) => sum + lot.quantity, 0);
  const primaryQuality = primaryQualityFromLots(boundedLots, factors.minQuality ?? '凡品');
  return {
    essence: {
      rawEssence,
      effectiveEssence,
      qualityPotential,
      purity: Number(purity.toFixed(4)),
      stability,
    },
    primaryQuality,
    lots: boundedLots,
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
    distributionSummary: boundedLots.map((lot) => `${lot.quality}/${lot.appearance}×${lot.quantity}`).join('、'),
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
    primaryQualities[0] ?? qualityFromPotential(qualityPotential),
  );
  const maxPrimary = primaryQualities.reduce(
    (highest, quality) => QUALITY_ORDER[quality] > QUALITY_ORDER[highest] ? quality : highest,
    primaryQualities[0] ?? qualityFromPotential(qualityPotential),
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

export function scaleOperationsForOutputLot(
  operations: ConditionOperation[],
  sourceQuality: Quality,
  sourceAppearance: PillAppearanceGrade,
  targetQuality: Quality,
  targetAppearance: PillAppearanceGrade,
): ConditionOperation[] {
  const sourceMultiplier =
    PILL_CONDENSATION_MULTIPLIER_BY_QUALITY[sourceQuality] *
    PILL_APPEARANCE_EFFECT_MULTIPLIER[sourceAppearance];
  const targetMultiplier =
    PILL_CONDENSATION_MULTIPLIER_BY_QUALITY[targetQuality] *
    PILL_APPEARANCE_EFFECT_MULTIPLIER[targetAppearance];
  const factor = clamp(targetMultiplier / Math.max(0.01, sourceMultiplier), 0.2, 8);
  return operations.map((operation) => {
    if (operation.type === 'change_gauge' && operation.delta > 0) {
      return {
        ...operation,
        delta: Math.max(
          0,
          Math.round(
            buildPositivePillToxicity(targetQuality) *
              getPillAppearanceToxicityMultiplier(targetAppearance),
          ),
        ),
      };
    }
    return scalePillEffectOperation(operation, factor, { final: true });
  });
}
