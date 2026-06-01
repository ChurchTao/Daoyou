import {
  BASE_STABILITY_BY_TYPE,
  BASE_TOXICITY_BY_TYPE,
  POTENCY_BY_QUALITY,
  QUALITY_STABILITY_BONUS,
  type AlchemyMaterialType,
} from '@shared/config/alchemyConfig';
import { getConsumableQualityScalar } from '@shared/config/consumableSystem';
import {
  buildCultivationGain,
  buildInsightGain,
  scaleProgressGain,
} from '@shared/lib/alchemyProgress';
import {
  getAlchemyPropertyFamily,
  getAlchemyPropertyLabel,
  getAlchemyPropertyTrackPath,
  isLongTermAlchemyProperty,
  normalizeWeightedAlchemyProperties,
  sortWeightedAlchemyProperties,
} from '@shared/lib/alchemyProperties';
import { getHealingCuredStatus } from '@shared/lib/healingPill';
import type { ElementType, Quality, RealmType } from '@shared/types/constants';
import type {
  AlchemyFocusMode,
  AlchemyMaterialPropertyVector,
  AlchemyPropertyKey,
  AlchemyRecipePlan,
  ConditionOperation,
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

function buildRestoreValue(baseRatio: number, scalar: number): number {
  return Number((baseRatio * scalar).toFixed(4));
}

function scaleRestoreOperationValue(
  operation: Extract<ConditionOperation, { type: 'restore_resource' }>,
  factor: number,
): Extract<ConditionOperation, { type: 'restore_resource' }> {
  if (operation.mode === 'percent') {
    return {
      ...operation,
      value: Math.max(0.0001, Number((operation.value * factor).toFixed(4))),
    };
  }

  return {
    ...operation,
    value: Math.max(1, Math.floor(operation.value * factor)),
  };
}

function scalePropertyOperation(
  operation: ConditionOperation,
  factor: number,
): ConditionOperation {
  if (factor === 1) {
    return operation;
  }

  switch (operation.type) {
    case 'restore_resource':
      return scaleRestoreOperationValue(operation, factor);
    case 'advance_track':
      return {
        ...operation,
        value: Math.max(1, Math.floor(operation.value * factor)),
      };
    case 'gain_progress':
      return {
        ...operation,
        value: scaleProgressGain(operation.value, factor),
      };
    case 'change_gauge':
      return {
        ...operation,
        delta:
          operation.delta > 0
            ? Math.max(1, Math.round(operation.delta * factor))
            : Math.min(-1, Math.round(operation.delta * factor)),
      };
    default:
      return operation;
  }
}

function applyLowStabilityPenalty(
  operations: ConditionOperation[],
): ConditionOperation[] {
  return operations.map((operation) => {
    if (operation.type === 'restore_resource') {
      return scaleRestoreOperationValue(operation, 0.8);
    }

    if (operation.type === 'advance_track') {
      return {
        ...operation,
        value: Math.max(1, Math.floor(operation.value * 0.8)),
      };
    }

    if (operation.type === 'gain_progress') {
      return {
        ...operation,
        value: scaleProgressGain(operation.value, 0.8),
      };
    }

    return operation;
  });
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
  realm: RealmType,
): ConditionOperation {
  const scalar = getConsumableQualityScalar(quality);

  switch (key) {
    case 'restore_hp':
      return {
        type: 'restore_resource',
        resource: 'hp',
        mode: 'percent',
        value: buildRestoreValue(0.12, scalar),
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
        value: buildRestoreValue(0.09, scalar),
      };
    case 'detox':
      return {
        type: 'change_gauge',
        gauge: 'pillToxicity',
        delta: -Math.floor(18 * scalar),
      };
    case 'cultivation':
      return {
        type: 'gain_progress',
        target: 'cultivation_exp',
        value: buildCultivationGain(realm, quality),
      };
    case 'insight':
      return {
        type: 'gain_progress',
        target: 'comprehension_insight',
        value: buildInsightGain(quality),
      };
    case 'clear_mind_support':
      return {
        type: 'add_status',
        status: 'clear_mind',
        usesRemaining: 1,
      };
    case 'protect_meridians_support':
      return {
        type: 'add_status',
        status: 'protect_meridians',
        usesRemaining: 1,
      };
    case 'breakthrough_support':
      return {
        type: 'add_status',
        status: 'breakthrough_focus',
        usesRemaining: 1,
      };
    case 'marrow_wash':
      return {
        type: 'advance_track',
        track: 'marrow_wash',
        value: Math.max(20, Math.floor(40 * scalar)),
      };
    case 'tempering_vitality':
    case 'tempering_spirit':
    case 'tempering_wisdom':
    case 'tempering_speed':
    case 'tempering_willpower': {
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

function buildPositiveToxicityDelta(
  toxicityRating: number,
  selectedProperties: WeightedAlchemyProperty[],
): number {
  const positivePropertyCount = selectedProperties.filter(
    (property) => property.key !== 'detox',
  ).length;
  if (positivePropertyCount === 0) {
    return 0;
  }

  return clamp(Math.round(toxicityRating / 2), 2, 14);
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
  realm: RealmType,
  toxicityRating: number,
): ConditionOperation[] {
  const operations = selectedProperties.map((property, index) => {
    const baseOperation = buildBasePropertyOperation(
      property.key,
      quality,
      realm,
    );
    const scalar =
      PROPERTY_OPERATION_SCALARS[index] ?? PROPERTY_OPERATION_SCALARS[2];
    return scalePropertyOperation(baseOperation, scalar);
  });

  const existingGaugeIndex = operations.findIndex(
    (operation) =>
      operation.type === 'change_gauge' && operation.gauge === 'pillToxicity',
  );
  const positiveToxicityDelta = buildPositiveToxicityDelta(
    toxicityRating,
    selectedProperties,
  );

  if (positiveToxicityDelta > 0) {
    if (existingGaugeIndex >= 0) {
      const current = operations[existingGaugeIndex];
      if (current?.type === 'change_gauge') {
        operations[existingGaugeIndex] = {
          ...current,
          delta: current.delta + positiveToxicityDelta,
        };
      }
    } else {
      operations.push({
        type: 'change_gauge',
        gauge: 'pillToxicity',
        delta: positiveToxicityDelta,
      });
    }
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
  realm: RealmType,
): SynthesizedAlchemyResult {
  const aggregated = aggregateAlchemyProperties(materials, plan);
  const family = determineAlchemyFamily(aggregated.propertyVector);
  let operations = buildPropertyOperationSet(
    aggregated.propertyVector,
    quality,
    realm,
    aggregated.toxicityRating,
  );

  if (aggregated.stability < 45) {
    operations = applyLowStabilityPenalty(operations);
  }

  return {
    ...aggregated,
    family,
    operations,
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
