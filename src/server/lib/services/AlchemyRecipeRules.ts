import {
  BASE_STABILITY_BY_TYPE,
  BASE_TOXICITY_BY_TYPE,
  POTENCY_BY_QUALITY,
  QUALITY_STABILITY_BONUS,
  type AlchemyMaterialType,
} from '@shared/config/alchemyConfig';
import {
  buildCultivationBoostOperation,
  CULTIVATION_BOOST_STATUS_KEY,
  getCultivationBoostPercent,
  buildCultivationBoostPayload,
  normalizeCultivationBoostPercent,
  type CultivationBoostPayload,
} from '@shared/lib/cultivationBoost';
import { buildInsightGain } from '@shared/lib/alchemyProgress';
import { rollPillAppearance } from '@shared/lib/pillAppearance';
import {
  applyPillAppearanceToOperations,
  buildBodyTrackAdvance,
  buildBreakthroughFocusOperation,
  buildClearMindOperation,
  buildDetoxPower,
  buildLifespanGain,
  buildPositivePillToxicity,
  buildProtectMeridiansOperation,
  buildRestorePercent,
  scalePillEffectOperation,
} from '@shared/lib/pillEffectScaling';
import {
  getAlchemyPropertyFamily,
  getAlchemyPropertyLabel,
  getAlchemyPropertyTrackPath,
  isLongTermAlchemyProperty,
  normalizeWeightedAlchemyProperties,
  sortWeightedAlchemyProperties,
} from '@shared/lib/alchemyProperties';
import { getHealingCuredStatus } from '@shared/lib/healingPill';
import type {
  ElementType,
  Quality,
  RealmStage,
  RealmType,
} from '@shared/types/constants';
import { QUALITY_ORDER } from '@shared/types/constants';
import type {
  AlchemyFocusMode,
  AlchemyBatchPreview,
  AlchemyBatchProfile,
  AlchemyMaterialPropertyVector,
  AlchemyPropertyKey,
  AlchemyRecipePlan,
  ConditionOperation,
  FormulaFitBand,
  FormulaMaterialJudgment,
  PillAppearanceGrade,
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
  operations: ConditionOperation[];
  appearance: PillAppearanceGrade;
  batchProfile: AlchemyBatchProfile;
}

export interface AlchemyCultivationSnapshotContext {
  realm: RealmType;
  realmStage?: RealmStage;
  expCap?: number;
}

export interface AlchemySynthesisOptions {
  rng?: () => number;
}

const FOCUS_BONUS: Record<AlchemyFocusMode, number> = {
  focused: 0.8,
  balanced: 0.5,
  risky: 0.9,
};

const PROPERTY_OPERATION_SCALARS = [1, 0.35, 0.2] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function scalePropertyOperation(
  operation: ConditionOperation,
  factor: number,
): ConditionOperation {
  return scalePillEffectOperation(operation, factor);
}

function applyLowStabilityPenalty(
  operations: ConditionOperation[],
): ConditionOperation[] {
  return operations.map((operation) => scalePillEffectOperation(operation, 0.8));
}

function getMaterialContribution(material: PreparedAlchemyMaterial): number {
  return material.dose * POTENCY_BY_QUALITY[material.rank];
}

function getYieldContribution(
  material: PreparedAlchemyMaterial,
  targetRank: Quality,
): number {
  const qualityGap = QUALITY_ORDER[targetRank] - QUALITY_ORDER[material.rank];
  if (qualityGap <= 0) {
    return getMaterialContribution(material);
  }
  if (qualityGap === 1) {
    return getMaterialContribution(material) * 0.75;
  }
  return 0;
}

function getHighestMaterialRank(materials: PreparedAlchemyMaterial[]): Quality {
  return materials.reduce<Quality>(
    (best, material) =>
      QUALITY_ORDER[material.rank] > QUALITY_ORDER[best]
        ? material.rank
        : best,
    materials[0]!.rank,
  );
}

function isYieldSupportingMaterial(
  material: PreparedAlchemyMaterial,
  targetRank: Quality,
): boolean {
  return QUALITY_ORDER[targetRank] - QUALITY_ORDER[material.rank] <= 1;
}

function countYieldSupportingMaterials(
  materials: PreparedAlchemyMaterial[],
  targetRank: Quality,
): number {
  return materials.filter((material) =>
    isYieldSupportingMaterial(material, targetRank),
  ).length;
}

function roundScore(value: number): number {
  return Number(clamp(value, 0, 1).toFixed(4));
}

function sumMaterialDose(materials: PreparedAlchemyMaterial[]): number {
  return materials.reduce((sum, material) => sum + Math.max(1, material.dose), 0);
}

function calculateBaseYield(materials: PreparedAlchemyMaterial[]): number {
  if (materials.length === 0) {
    return 1;
  }

  const highestRank = getHighestMaterialRank(materials);
  const targetUnitContribution = POTENCY_BY_QUALITY[highestRank];
  if (targetUnitContribution <= 0) {
    return 1;
  }
  const effectiveContribution = materials.reduce(
    (sum, material) => sum + getYieldContribution(material, highestRank),
    0,
  );

  return clamp(Math.floor(effectiveContribution / targetUnitContribution), 1, 5);
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

function buildBasePropertyOperation(
  key: AlchemyPropertyKey,
  quality: Quality,
): ConditionOperation {
  switch (key) {
    case 'restore_hp':
      return {
        type: 'restore_resource',
        resource: 'hp',
        mode: 'percent',
        value: buildRestorePercent(quality),
      };
    case 'heal_wounds':
      return {
        type: 'remove_status',
        status: getHealingCuredStatus(quality),
      };
    case 'restore_mp':
      return {
        type: 'restore_resource',
        resource: 'mp',
        mode: 'percent',
        value: buildRestorePercent(quality),
      };
    case 'detox':
      return {
        type: 'change_gauge',
        gauge: 'pillToxicity',
        delta: -buildDetoxPower(quality),
      };
    case 'cultivation':
      return buildCultivationBoostOperation(quality);
    case 'insight':
      return {
        type: 'gain_progress',
        target: 'comprehension_insight',
        value: buildInsightGain(quality),
      };
    case 'clear_mind_support':
      return buildClearMindOperation(quality);
    case 'protect_meridians_support':
      return buildProtectMeridiansOperation(quality);
    case 'breakthrough_support':
      return buildBreakthroughFocusOperation(quality);
    case 'extend_lifespan':
      return {
        type: 'increase_lifespan',
        value: buildLifespanGain(quality),
      };
    case 'marrow_wash':
      return {
        type: 'advance_track',
        track: 'marrow_wash',
        value: buildBodyTrackAdvance(quality),
      };
    case 'body_skin':
    case 'body_sinew_bone':
    case 'body_organs':
    case 'body_qi_blood':
    case 'body_primordial_spirit': {
      const track = getAlchemyPropertyTrackPath(key);
      if (!track) {
        throw new AlchemyServiceError(`未找到药性 ${key} 对应的炼体路径`, 500);
      }

      return {
        type: 'advance_track',
        track,
        value: buildBodyTrackAdvance(quality),
      };
    }
  }
}

function mergeCultivationBoostOperation(
  left: Extract<ConditionOperation, { type: 'add_status' }>,
  right: Extract<ConditionOperation, { type: 'add_status' }>,
): Extract<ConditionOperation, { type: 'add_status' }> {
  const boostPercent = normalizeCultivationBoostPercent(
    getCultivationBoostPercent(left) + getCultivationBoostPercent(right),
  );
  const payload: CultivationBoostPayload =
    buildCultivationBoostPayload(boostPercent);

  return {
    ...left,
    usesRemaining: 1,
    payload,
  };
}

function buildPositiveToxicityDelta(
  quality: Quality,
  appearance: PillAppearanceGrade,
  selectedProperties: WeightedAlchemyProperty[],
): number {
  if (selectedProperties.some((property) => property.key === 'detox')) {
    return 0;
  }

  const positivePropertyCount = selectedProperties.filter(
    (property) => property.key !== 'detox',
  ).length;
  if (positivePropertyCount === 0) {
    return 0;
  }

  const multiplier =
    appearance === 'low'
      ? 1.5
      : appearance === 'middle'
        ? 1
        : appearance === 'high'
          ? 0.6
          : 0;
  return Math.round(buildPositivePillToxicity(quality) * multiplier);
}

function appendPositiveToxicityOperation(
  operations: ConditionOperation[],
  quality: Quality,
  appearance: PillAppearanceGrade,
  selectedProperties: WeightedAlchemyProperty[],
): ConditionOperation[] {
  const delta = buildPositiveToxicityDelta(
    quality,
    appearance,
    selectedProperties,
  );
  if (delta <= 0) {
    return operations;
  }

  return [
    ...operations,
    {
      type: 'change_gauge',
      gauge: 'pillToxicity',
      delta,
    },
  ];
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

function buildPropertyOperationSet(
  selectedProperties: WeightedAlchemyProperty[],
  quality: Quality,
  secondaryEffectMultiplierBonus = 0,
): ConditionOperation[] {
  const operations = selectedProperties.map((property, index) => {
    const baseOperation = buildBasePropertyOperation(
      property.key,
      quality,
    );
    const baseScalar =
      PROPERTY_OPERATION_SCALARS[index] ?? PROPERTY_OPERATION_SCALARS[2];
    const scalar =
      index === 0
        ? baseScalar
        : Math.min(0.65, baseScalar * (1 + secondaryEffectMultiplierBonus));
    return scalePropertyOperation(baseOperation, scalar);
  });

  const cultivationBoostOperations = operations.filter(
    (
      operation,
    ): operation is Extract<ConditionOperation, { type: 'add_status' }> =>
      operation.type === 'add_status' &&
      operation.status === CULTIVATION_BOOST_STATUS_KEY,
  );
  if (cultivationBoostOperations.length > 1) {
    const mergedBoost = cultivationBoostOperations.reduce(
      mergeCultivationBoostOperation,
    );
    return [
      ...operations.filter(
        (operation) =>
          operation.type !== 'add_status' ||
          operation.status !== CULTIVATION_BOOST_STATUS_KEY,
      ),
      mergedBoost,
    ];
  }

  return operations;
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

export function buildAlchemyPreviewWarnings(
  materials: PreparedAlchemyMaterial[],
): string[] {
  const warnings: string[] = [];
  const estimatedPropertyCount = clamp(materials.length, 1, 3);
  const { stability, toxicityRating } = buildStabilityAndToxicity(
    materials,
    estimatedPropertyCount,
    'balanced',
  );

  if (materials.length >= 3 || stability < 45) {
    warnings.push('材料药路偏杂，预计炉性易浮，成丹稳度可能偏低。');
  }

  if (toxicityRating >= 12) {
    warnings.push('药底略显燥烈，预计丹毒偏高，服用后需留意调息。');
  }

  return warnings;
}

export function buildAlchemyBatchPreview(
  materials: PreparedAlchemyMaterial[],
): AlchemyBatchPreview {
  const baseYield = calculateBaseYield(materials);
  const materialKindCount = materials.length;
  const totalDose = sumMaterialDose(materials);
  const canGainYieldBonus =
    materialKindCount > 1 &&
    countYieldSupportingMaterials(materials, getHighestMaterialRank(materials)) >
      1;
  const maxYield =
    canGainYieldBonus ? Math.min(5, baseYield + 1) : baseYield;
  const warnings = buildAlchemyPreviewWarnings(materials);

  return {
    minYield: Math.max(1, Math.min(baseYield, maxYield)),
    maxYield,
    materialKindCount,
    totalDose,
    summary:
      materialKindCount <= 1
        ? '单材成丹，药路稳定但变化有限。'
        : '多材合炉，实际产量取决于药性配伍与炉势。',
    warnings,
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
    formulaFitScore?: number;
    materialJudgments?: FormulaMaterialJudgment[];
  } = {},
): AlchemyBatchProfile {
  const materialKindCount = materials.length;
  const baseYield = calculateBaseYield(materials);
  const highestRank =
    materials.length > 0 ? getHighestMaterialRank(materials) : undefined;
  const yieldSupportingMaterialCount = highestRank
    ? countYieldSupportingMaterials(materials, highestRank)
    : 0;
  const dominantProperty = aggregated.propertyVector[0]?.key;
  const primaryByRef = getPrimaryPropertyByMaterial(aggregated);
  const primaryMatches = dominantProperty
    ? materials.filter(
        (material) => primaryByRef.get(material.materialRef) === dominantProperty,
      ).length
    : 0;
  const uniquePrimaryProperties = new Set(primaryByRef.values());
  const auxCount = materials.filter((material) => material.type === 'aux').length;
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
    ? options.materialJudgments.filter((judgment) => judgment.verdict === 'core')
        .length / options.materialJudgments.length * 0.18
    : 0;
  const fitScoreBonus =
    options.formulaFitBand === 'aligned'
      ? Math.min(0.18, (options.formulaFitScore ?? 0) * 0.18)
      : 0;
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
  const secondaryEffectMultiplierBonus =
    materialKindCount > 1 && synergyScore >= 0.45 && conflictScore < 0.55
      ? roundScore(Math.min(0.65, synergyScore * 0.7))
      : 0;

  let yieldQuantity = baseYield;
  const adjustedStability = aggregated.stability + stabilityDelta;
  if (
    materialKindCount > 1 &&
    yieldSupportingMaterialCount > 1 &&
    synergyScore >= 0.65 &&
    conflictScore < 0.45 &&
    adjustedStability >= 55
  ) {
    yieldQuantity += 1;
  }
  if (adjustedStability < 45 || conflictScore >= 0.65) {
    yieldQuantity -= 1;
  }
  if (options.formulaFitBand === 'degraded') {
    yieldQuantity = Math.min(yieldQuantity, 3);
  } else if (options.formulaFitBand === 'poor') {
    yieldQuantity = Math.min(yieldQuantity - 1, 2);
  }
  yieldQuantity = clamp(yieldQuantity, 1, 5);

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
    yieldQuantity,
    synergyScore,
    conflictScore,
    compoundTier,
    roleSummary,
    stabilityDelta,
    toxicityDelta,
    secondaryEffectMultiplierBonus,
  };
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
  quality: Quality,
  _cultivationContextOrRealm: AlchemyCultivationSnapshotContext | RealmType,
  options: AlchemySynthesisOptions = {},
): SynthesizedAlchemyResult {
  const baseAggregated = aggregateAlchemyProperties(materials, plan);
  const batchProfile = buildAlchemyBatchProfile(materials, baseAggregated);
  const aggregated = {
    ...baseAggregated,
    stability: Math.round(
      clamp(baseAggregated.stability + batchProfile.stabilityDelta, 15, 95),
    ),
    toxicityRating: Math.round(
      clamp(
        baseAggregated.toxicityRating + batchProfile.toxicityDelta,
        0,
        100,
      ),
    ),
  };
  const family = determineAlchemyFamily(aggregated.propertyVector);
  let operations = buildPropertyOperationSet(
    aggregated.propertyVector,
    quality,
    batchProfile.secondaryEffectMultiplierBonus,
  );
  const appearance = rollPillAppearance({
    stability: aggregated.stability,
    propertyVector: aggregated.propertyVector,
    rng: options.rng,
  });

  if (aggregated.stability < 45) {
    operations = applyLowStabilityPenalty(operations);
  }

  operations = applyPillAppearanceToOperations(operations, appearance);
  operations = appendPositiveToxicityOperation(
    operations,
    quality,
    appearance,
    aggregated.propertyVector,
  );

  return {
    ...aggregated,
    family,
    operations,
    appearance,
    batchProfile,
  };
}

export function calculatePropertyVectorFit(
  currentVector: WeightedAlchemyProperty[],
  blueprintVector: WeightedAlchemyProperty[],
): number {
  const currentMap = new Map(
    currentVector.map((property) => [property.key, property.weight]),
  );

  return Number(
    blueprintVector
      .reduce(
        (sum, property) =>
          sum + Math.min(currentMap.get(property.key) ?? 0, property.weight),
        0,
      )
      .toFixed(4),
  );
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
