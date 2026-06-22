import {
  BASE_STABILITY_BY_TYPE,
  BASE_TOXICITY_BY_TYPE,
  POTENCY_BY_QUALITY,
  QUALITY_STABILITY_BONUS,
  type AlchemyMaterialType,
} from '@shared/config/alchemyConfig';
import { getConsumableQualityScalar } from '@shared/config/consumableSystem';
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
import type {
  AlchemyFocusMode,
  AlchemyMaterialPropertyVector,
  AlchemyPropertyKey,
  AlchemyRecipePlan,
  ConditionOperation,
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
  element: ElementType;
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

const PROPERTY_OPERATION_SCALARS = [1, 0.75, 0.55] as const;

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

export function getQuotaCategoryForFamily(
  family: PillFamily,
): PillQuotaCategory {
  switch (family) {
    case 'tempering':
    case 'marrow_wash':
      return 'long_term';
    case 'longevity':
      return 'longevity';
    case 'cultivation':
      return 'cultivation';
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
  const scalar = getConsumableQualityScalar(quality);

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
        value: Math.max(20, Math.floor(40 * scalar)),
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
        value: Math.max(20, Math.floor(40 * scalar)),
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
): ConditionOperation[] {
  const operations = selectedProperties.map((property, index) => {
    const baseOperation = buildBasePropertyOperation(
      property.key,
      quality,
    );
    const scalar =
      PROPERTY_OPERATION_SCALARS[index] ?? PROPERTY_OPERATION_SCALARS[2];
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
  const aggregated = aggregateAlchemyProperties(materials, plan);
  const family = determineAlchemyFamily(aggregated.propertyVector);
  let operations = buildPropertyOperationSet(
    aggregated.propertyVector,
    quality,
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
