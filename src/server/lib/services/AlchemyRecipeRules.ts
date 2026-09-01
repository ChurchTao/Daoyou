import {
  BASE_STABILITY_BY_TYPE,
  BASE_TOXICITY_BY_TYPE,
  QUALITY_STABILITY_BONUS,
  type AlchemyMaterialType,
} from '@shared/config/alchemyConfig';
import { MATERIAL_ESSENCE_BY_QUALITY } from '@shared/config/alchemyEssenceConfig';
import {
  getAlchemyPropertyFamily,
  getAlchemyPropertyLabel,
  isLongTermAlchemyProperty,
  normalizeWeightedAlchemyProperties,
  sortWeightedAlchemyProperties,
} from '@shared/lib/alchemyProperties';
import {
  calculateEffectiveEssence,
  calculateQualityPotential,
  calculateRawEssence,
  type AlchemyEssenceMaterial,
} from '@shared/lib/alchemyYield';
import type { ElementType, Quality } from '@shared/types/constants';
import { QUALITY_ORDER } from '@shared/types/constants';
import type {
  AlchemyBatchProfile,
  AlchemyFocusMode,
  AlchemyMaterialPropertyVector,
  AlchemyPropertyKey,
  AlchemyRecipePlan,
  FormulaFitBand,
  FormulaMaterialJudgment,
  PillFamily,
  PillQuotaCategory,
  WeightedAlchemyProperty,
} from '@shared/types/consumable';
import { AlchemyServiceError } from './AlchemyServiceError';

export interface PreparedAlchemyMaterial {
  id: string;
  materialRef: string;
  name: string;
  description: string;
  rank: Quality;
  element?: ElementType;
  type: AlchemyMaterialType;
  dose: number;
}

export interface AggregatedAlchemyProperties {
  focusMode: AlchemyFocusMode;
  rawPropertyVector: WeightedAlchemyProperty[];
  propertyVector: WeightedAlchemyProperty[];
  sourceMaterialVectors: AlchemyMaterialPropertyVector[];
  dominantElement: ElementType;
  stability: number;
  toxicityRating: number;
}

export interface SynthesizedAlchemyResult extends AggregatedAlchemyProperties {
  family: PillFamily;
  batchProfile: AlchemyBatchProfile;
}

const FOCUS_BONUS: Record<AlchemyFocusMode, number> = {
  focused: 0.8,
  balanced: 0.5,
  risky: 0.9,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getMaterialContribution(material: PreparedAlchemyMaterial): number {
  return material.dose * MATERIAL_ESSENCE_BY_QUALITY[material.rank];
}

function roundScore(value: number): number {
  return Number(clamp(value, 0, 1).toFixed(4));
}

export function getQuotaCategoryForFamily(
  family: PillFamily,
): PillQuotaCategory {
  switch (family) {
    case 'longevity':
      return 'longevity';
    case 'cultivation':
    case 'marrow_wash':
    case 'tempering':
    case 'breakthrough':
      return 'none';
    default:
      return 'none';
  }
}

export function chooseDominantElement(
  materials: PreparedAlchemyMaterial[],
  requestedElementBias?: ElementType,
): ElementType {
  const elementScores = new Map<ElementType, number>();

  for (const material of materials) {
    if (!material.element) {
      continue;
    }
    elementScores.set(
      material.element,
      (elementScores.get(material.element) ?? 0) +
        getMaterialContribution(material),
    );
  }

  const entries = [...elementScores.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0], 'zh-Hans-CN');
  });

  const [first, second] = entries;
  if (!first) {
    return requestedElementBias ?? '土';
  }

  if (
    requestedElementBias &&
    second &&
    requestedElementBias !== first[0] &&
    [first[0], second[0]].includes(requestedElementBias) &&
    second[1] >= first[1] * 0.9
  ) {
    return requestedElementBias;
  }

  return first[0];
}

function selectEffectiveProperties(
  rawPropertyVector: WeightedAlchemyProperty[],
  focusMode: AlchemyFocusMode,
): WeightedAlchemyProperty[] {
  const active = sortWeightedAlchemyProperties(
    rawPropertyVector.filter((property) => property.weight >= 0.18),
  );
  const fallbackActive =
    active.length > 0 ? active : rawPropertyVector.slice(0, 1);
  const selected: WeightedAlchemyProperty[] = [];
  let selectedLongTerm = false;
  const maxProperties = focusMode === 'focused' ? 2 : 3;

  for (const property of fallbackActive) {
    if (selected.length >= maxProperties) {
      break;
    }

    if (isLongTermAlchemyProperty(property.key)) {
      if (selectedLongTerm) {
        continue;
      }
      selectedLongTerm = true;
    }

    selected.push(property);
  }

  return selected;
}

export function determineAlchemyFamily(
  propertyVector: WeightedAlchemyProperty[],
): PillFamily {
  const restoreHp = propertyVector.find(
    (property) => property.key === 'restore_hp',
  );
  const restoreMp = propertyVector.find(
    (property) => property.key === 'restore_mp',
  );

  if (
    restoreHp &&
    restoreMp &&
    Math.min(restoreHp.weight, restoreMp.weight) >=
      Math.max(restoreHp.weight, restoreMp.weight) * 0.85
  ) {
    return 'hybrid';
  }

  const primary = propertyVector[0];
  if (!primary) {
    return 'healing';
  }

  return getAlchemyPropertyFamily(primary.key);
}

function buildStabilityAndToxicity(
  materials: PreparedAlchemyMaterial[],
  activePropertyCount: number,
  focusMode: AlchemyFocusMode,
): Pick<AggregatedAlchemyProperties, 'stability' | 'toxicityRating'> {
  let totalContribution = 0;
  let stabilitySum = 0;
  let toxicitySum = 0;

  for (const material of materials) {
    const contribution = getMaterialContribution(material);
    totalContribution += contribution;
    stabilitySum +=
      contribution *
      clamp(
        BASE_STABILITY_BY_TYPE[material.type] +
          QUALITY_STABILITY_BONUS[material.rank],
        0,
        100,
      );
    toxicitySum += contribution * BASE_TOXICITY_BY_TYPE[material.type];
  }

  const weightedAverageStability =
    totalContribution > 0 ? stabilitySum / totalContribution : 0;
  const weightedAverageToxicity =
    totalContribution > 0 ? toxicitySum / totalContribution : 0;
  const stabilityPenalty = 8 * Math.max(0, activePropertyCount - 1);
  const riskPenalty = focusMode === 'risky' ? 8 : 0;
  const stability = Math.round(
    clamp(weightedAverageStability - stabilityPenalty - riskPenalty, 15, 95),
  );
  const diversityToxicityBonus = 2 * Math.max(0, activePropertyCount - 1);
  const toxicityRating = Math.round(
    clamp(
      weightedAverageToxicity +
        diversityToxicityBonus +
        Math.max(0, 55 - stability) / 2 +
        (focusMode === 'risky' ? 6 : 0),
      0,
      100,
    ),
  );

  return {
    stability,
    toxicityRating,
  };
}

function getPrimaryPropertyByMaterial(
  aggregated: Pick<AggregatedAlchemyProperties, 'sourceMaterialVectors'>,
): Map<string, AlchemyPropertyKey> {
  return new Map(
    aggregated.sourceMaterialVectors.flatMap((vector) => {
      const primary = normalizeWeightedAlchemyProperties(vector.properties)[0];
      return primary ? [[vector.materialRef, primary.key]] : [];
    }),
  );
}

export function buildAlchemyBatchProfile(
  materials: PreparedAlchemyMaterial[],
  aggregated: Pick<
    AggregatedAlchemyProperties,
    | 'propertyVector'
    | 'rawPropertyVector'
    | 'sourceMaterialVectors'
    | 'stability'
    | 'toxicityRating'
    | 'focusMode'
  >,
  options: {
    formulaFitBand?: FormulaFitBand;
    materialJudgments?: FormulaMaterialJudgment[];
  } = {},
): AlchemyBatchProfile {
  const materialKindCount = materials.length;
  const dominantProperty = aggregated.propertyVector[0]?.key;
  const primaryByRef = getPrimaryPropertyByMaterial(aggregated);
  const primaryMatches = dominantProperty
    ? materials.filter(
        (material) =>
          primaryByRef.get(material.materialRef) === dominantProperty,
      ).length
    : 0;
  const uniquePrimaryProperties = new Set(primaryByRef.values());
  const auxCount = materials.filter(
    (material) => material.type === 'aux',
  ).length;
  const activePropertyCount = aggregated.propertyVector.length;

  const sameRouteScore =
    materialKindCount > 1 && dominantProperty
      ? primaryMatches / materialKindCount
      : 0;
  const complementaryScore =
    materialKindCount > 1 && activePropertyCount >= 2
      ? Math.min(0.3, (activePropertyCount - 1) * 0.12)
      : 0;
  const supportScore =
    materialKindCount > 1 ? Math.min(0.2, auxCount * 0.1) : 0;
  const judgmentScore = options.materialJudgments?.length
    ? (options.materialJudgments.filter(
        (judgment) => judgment.verdict === 'core',
      ).length /
        options.materialJudgments.length) *
      0.18
    : 0;
  const fitScoreBonus = options.formulaFitBand === 'aligned' ? 0.18 : 0;
  const synergyScore = roundScore(
    sameRouteScore * 0.68 +
      complementaryScore +
      supportScore +
      judgmentScore +
      fitScoreBonus,
  );

  const scatteredScore =
    materialKindCount > 1
      ? Math.max(0, uniquePrimaryProperties.size - 1) /
        Math.max(1, materialKindCount - 1)
      : 0;
  const riskyScore = aggregated.focusMode === 'risky' ? 0.18 : 0;
  const poorFitScore =
    options.formulaFitBand === 'poor'
      ? 0.45
      : options.formulaFitBand === 'degraded'
        ? 0.18
        : 0;
  const conflictScore = roundScore(
    scatteredScore * 0.45 +
      Math.max(0, activePropertyCount - 2) * 0.12 +
      riskyScore +
      poorFitScore,
  );

  const stabilityDelta = Math.round(
    synergyScore * 10 + auxCount * 2 - conflictScore * 14,
  );
  const toxicityDelta = Math.round(
    conflictScore * 18 - synergyScore * 8 - auxCount * 2,
  );
  const adjustedStability = aggregated.stability + stabilityDelta;

  const essenceMaterials: AlchemyEssenceMaterial[] = materials.map(
    (material) => ({
      rank: material.rank,
      type: material.type,
      dose: material.dose,
    }),
  );
  const rawEssence = calculateRawEssence(essenceMaterials);
  const essenceFactors = {
    synergyScore,
    conflictScore,
    stability: adjustedStability,
    purity: clamp(
      0.45 + qualityPotentialFromMaterials(materials) * 0.4,
      0.1,
      0.98,
    ),
  };
  const effectiveEssence = calculateEffectiveEssence(
    rawEssence,
    essenceFactors,
  );
  const qualityPotential = calculateQualityPotential(
    essenceMaterials,
    essenceFactors,
  );

  const compoundTier =
    materialKindCount <= 1
      ? 'single'
      : conflictScore >= 0.65
        ? 'conflict'
        : synergyScore >= 0.65
          ? 'synergy'
          : 'balanced';
  const roleSummary =
    compoundTier === 'single'
      ? '单材直炼'
      : compoundTier === 'synergy'
        ? '主辅相合'
        : compoundTier === 'conflict'
          ? '药路冲突'
          : '多材均衡';

  return {
    synergyScore,
    conflictScore,
    compoundTier,
    roleSummary,
    stabilityDelta,
    toxicityDelta,
    essenceSummary: {
      rawEssence,
      effectiveEssence,
      qualityPotential,
      purity: essenceFactors.purity,
      stability: clamp(adjustedStability, 0, 100),
    },
  };
}

function qualityPotentialFromMaterials(
  materials: PreparedAlchemyMaterial[],
): number {
  if (materials.length === 0) return 0;
  const max = Math.max(
    ...materials.map((material) => QUALITY_ORDER[material.rank]),
  );
  return clamp((max - 1) / 7, 0, 1);
}

function buildPlanVectorMap(
  vectors: AlchemyMaterialPropertyVector[],
): Map<string, WeightedAlchemyProperty[]> {
  return new Map(
    vectors.map((vector) => [
      vector.materialRef,
      normalizeWeightedAlchemyProperties(vector.properties).slice(0, 3),
    ]),
  );
}

export function aggregateAlchemyProperties(
  materials: PreparedAlchemyMaterial[],
  plan: AlchemyRecipePlan,
): AggregatedAlchemyProperties {
  const materialVectorMap = buildPlanVectorMap(plan.materialVectors);
  const intentWeightMap = new Map(
    normalizeWeightedAlchemyProperties(plan.intentVector).map((property) => [
      property.key,
      property.weight,
    ]),
  );
  const propertyScores = new Map<AlchemyPropertyKey, number>();
  const sourceMaterialVectors: AlchemyMaterialPropertyVector[] = [];

  for (const material of materials) {
    const vector = materialVectorMap.get(material.materialRef);
    if (!vector || vector.length === 0) {
      throw new AlchemyServiceError(
        `材料 ${material.name} 缺少可用药性解析。`,
        503,
      );
    }

    sourceMaterialVectors.push({
      materialRef: material.materialRef,
      materialName: material.name,
      properties: vector,
    });

    for (const property of vector) {
      const materialScore = getMaterialContribution(material) * property.weight;
      const intentWeight = intentWeightMap.get(property.key) ?? 0;
      const finalScore =
        materialScore * (1 + intentWeight * FOCUS_BONUS[plan.focusMode]);
      propertyScores.set(
        property.key,
        (propertyScores.get(property.key) ?? 0) + finalScore,
      );
    }
  }

  const rawPropertyVector = normalizeWeightedAlchemyProperties(
    [...propertyScores.entries()].map(([key, weight]) => ({ key, weight })),
  );
  if (rawPropertyVector.length === 0) {
    throw new AlchemyServiceError('丹意未明，请稍后重试。', 503);
  }

  const propertyVector = selectEffectiveProperties(
    rawPropertyVector,
    plan.focusMode,
  );
  const { stability, toxicityRating } = buildStabilityAndToxicity(
    materials,
    propertyVector.length,
    plan.focusMode,
  );

  return {
    focusMode: plan.focusMode,
    rawPropertyVector,
    propertyVector,
    sourceMaterialVectors,
    dominantElement: chooseDominantElement(
      materials,
      plan.requestedElementBias,
    ),
    stability,
    toxicityRating,
  };
}

export function synthesizeAlchemyFromPlan(
  materials: PreparedAlchemyMaterial[],
  plan: AlchemyRecipePlan,
): SynthesizedAlchemyResult {
  const baseAggregated = aggregateAlchemyProperties(materials, plan);
  const batchProfile = buildAlchemyBatchProfile(materials, baseAggregated);
  const aggregated = {
    ...baseAggregated,
    stability: Math.round(
      clamp(baseAggregated.stability + batchProfile.stabilityDelta, 15, 95),
    ),
    toxicityRating: Math.round(
      clamp(baseAggregated.toxicityRating + batchProfile.toxicityDelta, 0, 100),
    ),
  };
  const family = determineAlchemyFamily(aggregated.propertyVector);

  return {
    ...aggregated,
    family,
    batchProfile,
  };
}

export function buildAlchemyPropertyTags(
  propertyVector: WeightedAlchemyProperty[],
  family: PillFamily,
): string[] {
  return Array.from(
    new Set([...propertyVector.map((property) => property.key), family]),
  );
}

export function describeAlchemyPropertyVector(
  propertyVector: WeightedAlchemyProperty[],
): string {
  return propertyVector
    .map(
      (property) =>
        `${getAlchemyPropertyLabel(property.key)} ${Math.round(property.weight * 100)}%`,
    )
    .join('、');
}
