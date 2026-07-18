import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import {
  alchemyFormulas,
  consumables,
  cultivators,
  materials,
} from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import {
  aggregateAlchemyProperties,
  buildAlchemyBatchPreview,
  buildAlchemyBatchProfile,
  buildAlchemyPreviewWarnings,
  buildAlchemyPropertyTags,
  calculatePropertyVectorFit,
  getQuotaCategoryForFamily,
  type PreparedAlchemyMaterial,
} from '@server/lib/services/AlchemyRecipeRules';
import { calculateSingleElixirScore } from '@server/utils/rankingUtils';
import {
  calculateCraftCost,
  calculateHighestMaterialRank,
} from '@shared/engine/creation-v2/CraftCostCalculator';
import {
  CULTIVATION_BOOST_STATUS_KEY,
} from '@shared/lib/cultivationBoost';
import { buildInsightGain } from '@shared/lib/alchemyProgress';
import {
  getPillAppearanceToxicityMultiplier,
  rollPillAppearance,
} from '@shared/lib/pillAppearance';
import {
  applyPillAppearanceToOperations,
  buildBodyTrackAdvance,
  buildBreakthroughFocusOperation,
  buildClearMindOperation,
  buildCultivationBoostOperationV2,
  buildDetoxPower,
  buildLifespanGain,
  buildPositivePillToxicity,
  buildProtectMeridiansOperation,
  buildRestorePercent,
  scalePillEffectOperation,
} from '@shared/lib/pillEffectScaling';
import {
  formatAlchemyPropertyVector,
  normalizeWeightedAlchemyProperties,
} from '@shared/lib/alchemyProperties';
import {
  getBreakthroughPillLabel,
  getNextMajorRealm,
  hasBreakthroughFocusEffect,
} from '@shared/lib/breakthroughPill';
import {
  evaluateFateContext,
  getAlchemySpiritStoneMultiplier,
  scaleFateAdjustedValue,
} from '@shared/lib/fates';
import { getHealingCuredStatus } from '@shared/lib/healingPill';
import { isAlchemyMaterialType } from '@shared/lib/alchemyMaterials';
import {
  QUALITY_ORDER,
  type ElementType,
  type MaterialType,
  type Quality,
  type RealmType,
} from '@shared/types/constants';
import type {
  AlchemyBatchPreview,
  AlchemyBatchProfile,
  AlchemyFormula,
  AlchemyFormulaDiscoveryCandidate,
  AlchemyFormulaMastery,
  AlchemyFormulaPattern,
  AlchemyRecipePlan,
  ConditionOperation,
  FormulaAnalysisResult,
  FormulaFitBand,
  FormulaMaterialJudgment,
  PillAppearanceGrade,
  PillFamily,
  PillSpec,
  WeightedAlchemyProperty,
} from '@shared/types/consumable';
import type { Consumable, PreHeavenFate } from '@shared/types/cultivator';
import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { alchemyFormulaAnalyzer } from './AlchemyFormulaAnalyzer';
import { AlchemyServiceError } from './AlchemyServiceError';
import {
  mapConsumableCraftResult,
  serializeConsumableSpec,
} from './consumablePersistence';
import {
  addConsumableToInventory,
  getPlayerRuntimeCultivatorByIdUnsafe,
} from './cultivatorService';
import { getMysteryMaterialBlockingReason } from './materialMysteryGuard';
import { SectOrganizationService } from './SectOrganizationService';

const DISCOVERY_TTL_SECONDS = 600;
const FORMULA_ANALYSIS_TTL_SECONDS = 600;
const FORMULA_ANALYSIS_COOLDOWN_SECONDS = 30;
const FORMULA_LOCK_TTL_SECONDS = 30;
const DISCOVERY_STABILITY_THRESHOLD = 70;
const FIT_ALIGNED_THRESHOLD = 0.65;
const FIT_POOR_THRESHOLD = 0.35;
const DEGRADED_PENALTY_FACTOR_MIN = 0.78;
const DEGRADED_PENALTY_FACTOR_MAX = 0.9;
const POOR_PENALTY_FACTOR_MIN = 0.35;
const POOR_PENALTY_FACTOR_MAX = 0.62;

type MaterialRow = typeof materials.$inferSelect;
type AlchemyFormulaRow = typeof alchemyFormulas.$inferSelect;

export interface FormulaPreviewResult {
  cost: {
    spiritStones: number;
  };
  canAfford: boolean;
  validation: {
    valid: boolean;
    blockingReason?: string;
    warnings: string[];
  };
  batchPreview: AlchemyBatchPreview;
}

export interface FormulaProgress {
  previousLevel: number;
  level: number;
  exp: number;
  gainedExp: number;
  leveledUp: boolean;
}

export interface FormulaListPageOptions {
  page: number;
  pageSize: number;
  search?: string;
  family?: PillFamily;
}

export interface FormulaListPageResult {
  formulas: AlchemyFormula[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

interface DiscoveryPayload {
  cultivatorId: string;
  formula: Omit<AlchemyFormula, 'id' | 'createdAt' | 'updatedAt'>;
  signature: string;
}

interface FormulaAnalysisPayload {
  cultivatorId: string;
  formulaId: string;
  formulaMasteryLevel: number;
  signature: string;
  plan: AlchemyRecipePlan;
  fitScore: number;
  fitBand: FormulaFitBand;
  alignedThreshold: number;
  warnings: string[];
  materialJudgments: FormulaMaterialJudgment[];
  aggregatedPropertyVector: WeightedAlchemyProperty[];
  batchProfile: AlchemyBatchProfile;
  dominantElement: ElementType;
  stability: number;
  toxicityRating: number;
}

interface DiscoveryContext {
  consumable: Consumable & { spec: PillSpec };
  materials: PreparedAlchemyMaterial[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortJsonValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function normalizeDose(
  material: MaterialRow,
  materialQuantities?: Record<string, number>,
): number {
  const requested = materialQuantities?.[material.id];
  if (!requested || !Number.isFinite(requested)) {
    return 1;
  }

  return Math.max(1, Math.min(material.quantity, Math.floor(requested)));
}

function sortRowsByRequestedIds(
  rows: MaterialRow[],
  requestedIds: string[],
): MaterialRow[] {
  const order = new Map(requestedIds.map((id, index) => [id, index]));
  return [...rows].sort((left, right) => {
    const leftOrder = order.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = order.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

function isValidFormulaPattern(
  pattern: unknown,
): pattern is AlchemyFormulaPattern {
  if (!pattern || typeof pattern !== 'object') {
    return false;
  }

  const record = pattern as Record<string, unknown>;
  return (
    Array.isArray(record.targetPropertyVector) &&
    typeof record.slotCount === 'number'
  );
}

function mapAlchemyFormulaRow(row: AlchemyFormulaRow): AlchemyFormula {
  if (!isValidFormulaPattern(row.pattern)) {
    throw new AlchemyServiceError('丹方数据已损坏，请删除后重新悟方。', 500);
  }

  return {
    id: row.id,
    cultivatorId: row.cultivatorId,
    name: row.name,
    description: row.description,
    family: row.family,
    pattern: {
      ...row.pattern,
      targetPropertyVector: normalizeWeightedAlchemyProperties(
        row.pattern.targetPropertyVector as WeightedAlchemyProperty[],
      ),
    },
    blueprint: row.blueprint,
    mastery: row.mastery,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function getPatternSummary(pattern: AlchemyFormulaPattern): string {
  const segments = [
    `目标药性：${formatAlchemyPropertyVector(pattern.targetPropertyVector)}`,
    `炉位：${pattern.slotCount} 种材料`,
  ];

  if (pattern.dominantElement) {
    segments.push(`主元素：${pattern.dominantElement}`);
  }
  if (pattern.minQuality) {
    segments.push(`最低品阶：${pattern.minQuality}`);
  }

  return segments.join('；');
}

function getFormulaProductName(formulaName: string): string {
  return formulaName.endsWith('丹方')
    ? formulaName.slice(0, -2) || formulaName
    : formulaName;
}

function buildFallbackFormulaName(sourcePillName: string): string {
  return `${sourcePillName}丹方`;
}

function buildFallbackFormulaRecordDescription(
  formula: Pick<AlchemyFormula, 'family' | 'pattern'>,
): string {
  const qualityText = formula.pattern.minQuality
    ? `，宜以至少${formula.pattern.minQuality}之材承炉`
    : '';
  const directionText =
    formula.family === 'tempering'
      ? '缓推肉身淬炼之势'
      : formula.family === 'cultivation'
        ? '积蓄修为，温养道基'
      : formula.family === 'insight'
        ? '澄明心识，引动悟机'
        : formula.family === 'marrow_wash'
          ? '引药力洗筋伐髓'
          : formula.family === 'longevity'
            ? '固本延寿，续补命元'
            : '收束药性归于一脉';

  return `此方重在${directionText}，药性取向为${formatAlchemyPropertyVector(formula.pattern.targetPropertyVector)}，${formula.pattern.slotCount}味合炉${qualityText}。`;
}

function buildFallbackDiscoveryRemark(formulaName: string): string {
  return `炉中药脉已渐成章，《${formulaName}》的炉路可暂留于册。`;
}

function buildFormulaDescription(
  formula: AlchemyFormula,
  sourceMaterials: string[],
  stability: number,
  toxicityRating: number,
  fitScore: number,
  fitMultiplier: number,
  fitBand: FormulaFitBand,
): string {
  const lines = [
    `依《${formula.name}》炉意炼成，以${sourceMaterials.join('、')}合炉。`,
    `成丹稳度 ${stability}，药力拟合 ${(fitMultiplier * 100).toFixed(0)}%，丹毒评定 ${toxicityRating}。`,
  ];

  if (fitBand === 'degraded') {
    lines.push('本炉循方成丹，但药力散逸，终究未尽合丹方原意。');
  } else if (fitBand === 'poor') {
    lines.push('本炉药路偏离丹方甚远，虽可收丹，药力与品相都受明显折损。');
  } else if (fitScore < FIT_ALIGNED_THRESHOLD) {
    lines.push('本炉药性虽能循方成丹，仍有几分偏离，药力难免散逸。');
  }

  return lines.join('');
}

function createValidation(
  valid: boolean,
  blockingReason?: string,
  warnings: string[] = [],
) {
  return {
    valid,
    blockingReason,
    warnings,
  };
}

function buildPreparedMaterial(
  material: MaterialRow,
  index: number,
  materialQuantities?: Record<string, number>,
): PreparedAlchemyMaterial {
  const mysteryReason = getMysteryMaterialBlockingReason([material]);
  if (mysteryReason) {
    throw new AlchemyServiceError(mysteryReason, 400);
  }
  if (!isAlchemyMaterialType(material.type as MaterialType)) {
    throw new AlchemyServiceError(`材料 ${material.name} 不可用于炼丹`, 400);
  }
  if (!material.description?.trim()) {
    throw new AlchemyServiceError(
      `材料 ${material.name} 缺少描述，当前无法判明药性。`,
      400,
    );
  }

  return {
    id: material.id,
    materialRef: `material_${index + 1}`,
    name: material.name,
    description: material.description.trim(),
    rank: material.rank as Quality,
    element: material.element ? (material.element as ElementType) : undefined,
    type: material.type as PreparedAlchemyMaterial['type'],
    dose: normalizeDose(material, materialQuantities),
  };
}

function buildPreparedMaterials(
  materialRows: MaterialRow[],
  materialQuantities?: Record<string, number>,
): PreparedAlchemyMaterial[] {
  return materialRows.map((material, index) =>
    buildPreparedMaterial(material, index, materialQuantities),
  );
}

function getLowestQuality(materialsList: PreparedAlchemyMaterial[]): Quality {
  return materialsList.reduce((lowest, material) => {
    if (!lowest) {
      return material.rank;
    }
    return QUALITY_ORDER[material.rank] < QUALITY_ORDER[lowest]
      ? material.rank
      : lowest;
  }, materialsList[0]!.rank);
}

function getDiscoveryKey(cultivatorId: string, token: string): string {
  return `alchemy:formula_discovery:${cultivatorId}:${token}`;
}

function getFormulaAnalysisKey(cultivatorId: string, analysisId: string): string {
  return `alchemy:formula_analysis:${cultivatorId}:${analysisId}`;
}

function getFormulaAnalysisCooldownKey(cultivatorId: string): string {
  return `alchemy:formula_analysis:cooldown:${cultivatorId}`;
}

function getFormulaLockKey(cultivatorId: string): string {
  return `alchemy:lock:${cultivatorId}`;
}

function getFormulaMaterialVerdictOrder(
  verdict: FormulaMaterialJudgment['verdict'],
): number {
  switch (verdict) {
    case 'core':
      return 0;
    case 'usable':
      return 1;
    case 'conflict':
      return 2;
  }
}

function sortMaterialJudgments(
  judgments: FormulaMaterialJudgment[],
): FormulaMaterialJudgment[] {
  return [...judgments].sort((left, right) => {
    const verdictDelta =
      getFormulaMaterialVerdictOrder(left.verdict) -
      getFormulaMaterialVerdictOrder(right.verdict);
    if (verdictDelta !== 0) {
      return verdictDelta;
    }
    return left.materialName.localeCompare(right.materialName, 'zh-Hans-CN');
  });
}

function determineFormulaFitBand(fitScore: number): FormulaFitBand {
  if (fitScore >= FIT_ALIGNED_THRESHOLD) {
    return 'aligned';
  }
  if (fitScore < FIT_POOR_THRESHOLD) {
    return 'poor';
  }
  return 'degraded';
}

function calculateDegradedPenaltyFactor(fitScore: number): number {
  return clamp(
    0.55 + fitScore * 0.5,
    DEGRADED_PENALTY_FACTOR_MIN,
    DEGRADED_PENALTY_FACTOR_MAX,
  );
}

function calculatePoorPenaltyFactor(fitScore: number): number {
  return clamp(
    0.22 + fitScore * 0.9,
    POOR_PENALTY_FACTOR_MIN,
    POOR_PENALTY_FACTOR_MAX,
  );
}

async function checkAndAcquireFormulaAnalysisCooldown(
  cultivatorId: string,
): Promise<{
  allowed: boolean;
  remainingSeconds: number;
}> {
  const key = getFormulaAnalysisCooldownKey(cultivatorId);
  const result = await redis.set(
    key,
    '1',
    'EX',
    FORMULA_ANALYSIS_COOLDOWN_SECONDS,
    'NX',
  );

  if (result === 'OK') {
    return {
      allowed: true,
      remainingSeconds: FORMULA_ANALYSIS_COOLDOWN_SECONDS,
    };
  }

  const ttl = await redis.ttl(key);
  return {
    allowed: false,
    remainingSeconds:
      typeof ttl === 'number' && ttl > 0 ? ttl : FORMULA_ANALYSIS_COOLDOWN_SECONDS,
  };
}

function buildFormulaAnalysisSignature(
  cultivatorId: string,
  formulaId: string,
  formulaMasteryLevel: number,
  materialsList: PreparedAlchemyMaterial[],
): string {
  return stableStringify({
    cultivatorId,
    formulaId,
    formulaMasteryLevel,
    materials: materialsList.map((material) => ({
      id: material.id,
      dose: material.dose,
    })),
  });
}

function buildFormulaWarnings(
  formula: AlchemyFormula,
  materialsList: PreparedAlchemyMaterial[],
): string[] {
  return buildAlchemyPreviewWarnings(materialsList);
}

function validateFormulaIngredients(
  formula: AlchemyFormula,
  materialsList: PreparedAlchemyMaterial[],
) {
  if (materialsList.length !== formula.pattern.slotCount) {
    return createValidation(
      false,
      `此丹方需投入 ${formula.pattern.slotCount} 种材料。`,
    );
  }

  if (
    formula.pattern.minQuality &&
    materialsList.some(
      (material) =>
        QUALITY_ORDER[material.rank] <
        QUALITY_ORDER[formula.pattern.minQuality!],
    )
  ) {
    return createValidation(
      false,
      `所选材料中存在低于 ${formula.pattern.minQuality} 的品阶，无法承载此丹方。`,
    );
  }

  return createValidation(
    true,
    undefined,
    buildFormulaWarnings(formula, materialsList),
  );
}

export function buildFormulaSignature(
  formula: Pick<AlchemyFormula, 'family' | 'pattern' | 'blueprint'>,
): string {
  return stableStringify({
    family: formula.family,
    operations: formula.blueprint.operations,
    consumeRules: formula.blueprint.consumeRules,
    dominantElement: formula.pattern.dominantElement ?? null,
    minQuality: formula.pattern.minQuality ?? null,
    targetPropertyVector: normalizeWeightedAlchemyProperties(
      formula.pattern.targetPropertyVector,
    ),
    slotCount: formula.pattern.slotCount,
  });
}

function countMaterialsAboveMinQuality(
  materialsList: PreparedAlchemyMaterial[],
  minQuality?: Quality,
): number {
  if (!minQuality) {
    return 0;
  }

  return materialsList.filter(
    (material) => QUALITY_ORDER[material.rank] > QUALITY_ORDER[minQuality],
  ).length;
}

export function calculateFormulaFitMultiplier(
  formula: AlchemyFormula,
  currentPropertyVector: WeightedAlchemyProperty[],
  dominantElement: ElementType,
  materialsList: PreparedAlchemyMaterial[],
): number {
  const fit = calculatePropertyVectorFit(
    currentPropertyVector,
    formula.pattern.targetPropertyVector,
  );
  const elementBonus =
    formula.pattern.dominantElement &&
    dominantElement === formula.pattern.dominantElement
      ? 0.05
      : 0;
  const qualityBonus =
    countMaterialsAboveMinQuality(materialsList, formula.pattern.minQuality) *
    0.02;

  return clamp(0.85 + fit * 0.3 + elementBonus + qualityBonus, 0.85, 1.15);
}

function buildFormulaAnalysisPayload(
  cultivatorId: string,
  formula: AlchemyFormula,
  materialsList: PreparedAlchemyMaterial[],
  plan: AlchemyRecipePlan,
  materialJudgments: FormulaMaterialJudgment[],
): FormulaAnalysisPayload {
  const aggregated = aggregateAlchemyProperties(materialsList, plan);
  const fitScore = calculatePropertyVectorFit(
    aggregated.rawPropertyVector,
    formula.pattern.targetPropertyVector,
  );
  const fitBand = determineFormulaFitBand(fitScore);
  const batchProfile = buildAlchemyBatchProfile(materialsList, aggregated, {
    formulaFitBand: fitBand,
    formulaFitScore: fitScore,
    materialJudgments,
  });
  const warnings = buildFormulaWarnings(formula, materialsList);

  if (fitBand === 'degraded') {
    warnings.push('本炉虽可循方，但药力散逸较多，成丹后多半只得勉强之品。');
  } else if (fitBand === 'poor') {
    warnings.push('本炉药路偏离丹方甚远，强行收丹会明显削弱药力与品相。');
  }

  return {
    cultivatorId,
    formulaId: formula.id,
    formulaMasteryLevel: formula.mastery.level,
    signature: buildFormulaAnalysisSignature(
      cultivatorId,
      formula.id,
      formula.mastery.level,
      materialsList,
    ),
    plan,
    fitScore,
    fitBand,
    alignedThreshold: FIT_ALIGNED_THRESHOLD,
    warnings,
    materialJudgments: sortMaterialJudgments(materialJudgments),
    aggregatedPropertyVector: aggregated.rawPropertyVector,
    batchProfile,
    dominantElement: aggregated.dominantElement,
    stability: clamp(aggregated.stability + batchProfile.stabilityDelta, 15, 95),
    toxicityRating: clamp(
      aggregated.toxicityRating + batchProfile.toxicityDelta,
      0,
      100,
    ),
  };
}

function scaleFormulaOperations(
  operations: ConditionOperation[],
  fitMultiplier: number,
  quality: Quality,
  minQuality?: Quality,
): ConditionOperation[] {
  return operations.flatMap((operation): ConditionOperation[] => {
    if (operation.type === 'restore_resource') {
      return [
        scalePillEffectOperation(
          {
            ...operation,
            mode: 'percent',
            value: buildRestorePercent(quality),
          },
          fitMultiplier,
        ),
      ];
    }

    if (operation.type === 'gain_progress') {
      if (operation.target === 'cultivation_exp') {
        return [buildCultivationBoostOperationV2(quality, fitMultiplier)];
      }

      return [
        scalePillEffectOperation(
          {
            ...operation,
            value: buildInsightGain(quality),
          },
          fitMultiplier,
        ),
      ];
    }

    if (
      operation.type === 'remove_status' &&
      (operation.status === 'minor_wound' ||
        operation.status === 'major_wound' ||
        operation.status === 'near_death')
    ) {
      return [
        {
          ...operation,
          status: getHealingCuredStatus(quality),
        },
      ];
    }

    if (operation.type === 'advance_track') {
      if (
        minQuality &&
        (operation.track === 'marrow_wash' || operation.track.startsWith('body.'))
      ) {
        const baseValue = buildBodyTrackAdvance(minQuality);
        const qualityValue = buildBodyTrackAdvance(quality);
        return [
          scalePillEffectOperation(
            {
              ...operation,
              value: Math.max(
                1,
                Math.round(operation.value * (qualityValue / baseValue)),
              ),
            },
            fitMultiplier,
          ),
        ];
      }
      return [scalePillEffectOperation(operation, fitMultiplier)];
    }

    if (operation.type === 'increase_lifespan') {
      return [
        scalePillEffectOperation(
          {
            ...operation,
            value: buildLifespanGain(quality),
          },
          fitMultiplier,
        ),
      ];
    }

    if (operation.type === 'change_gauge') {
      if (operation.delta >= 0) {
        return [];
      }
      return [
        scalePillEffectOperation(
          {
            ...operation,
            delta: -buildDetoxPower(quality),
          },
          fitMultiplier,
        ),
      ];
    }

    if (
      operation.type === 'add_status' &&
      operation.status === CULTIVATION_BOOST_STATUS_KEY
    ) {
      return [buildCultivationBoostOperationV2(quality, fitMultiplier)];
    }

    if (
      operation.type === 'add_status' &&
      operation.status === 'breakthrough_focus'
    ) {
      return [buildBreakthroughFocusOperation(quality, fitMultiplier)];
    }

    if (
      operation.type === 'add_status' &&
      operation.status === 'protect_meridians'
    ) {
      return [buildProtectMeridiansOperation(quality, fitMultiplier)];
    }

    if (
      operation.type === 'add_status' &&
      operation.status === 'clear_mind'
    ) {
      return [buildClearMindOperation(quality)];
    }

    return [operation];
  });
}

function appendFormulaPositiveToxicity(
  operations: ConditionOperation[],
  quality: Quality,
  appearance: PillAppearanceGrade,
  propertyVector: WeightedAlchemyProperty[],
): ConditionOperation[] {
  if (propertyVector.some((property) => property.key === 'detox')) {
    return operations;
  }

  if (!propertyVector.some((property) => property.key !== 'detox')) {
    return operations;
  }

  const delta = Math.round(
    buildPositivePillToxicity(quality) *
      getPillAppearanceToxicityMultiplier(appearance),
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

function calculateFormulaMasteryGain(
  fitScore: number,
  fitBand: FormulaFitBand,
): number {
  if (fitBand === 'aligned') {
    return fitScore >= 0.9 ? 3 : 2;
  }
  if (fitBand === 'degraded') {
    return fitScore >= 0.5 ? 1 : 0;
  }
  return 0;
}

export function advanceFormulaMastery(
  mastery: AlchemyFormulaMastery,
  fitScore = 1,
  fitBand: FormulaFitBand = 'aligned',
): {
  next: AlchemyFormulaMastery;
  progress: FormulaProgress;
} {
  const gainedExp = calculateFormulaMasteryGain(fitScore, fitBand);
  let level = mastery.level;
  let exp = mastery.exp + gainedExp;

  while (exp >= 5 * (level + 1)) {
    exp -= 5 * (level + 1);
    level += 1;
  }

  return {
    next: {
      level,
      exp,
    },
    progress: {
      previousLevel: mastery.level,
      level,
      exp,
      gainedExp,
      leveledUp: level > mastery.level,
    },
  };
}

async function loadCultivatorFormula(
  cultivatorId: string,
  formulaId: string,
): Promise<AlchemyFormula> {
  const [row] = await getExecutor()
    .select()
    .from(alchemyFormulas)
    .where(
      and(
        eq(alchemyFormulas.id, formulaId),
        eq(alchemyFormulas.cultivatorId, cultivatorId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new AlchemyServiceError('未找到这份丹方。', 404);
  }

  return mapAlchemyFormulaRow(row);
}

async function loadOwnedMaterials(
  cultivatorId: string,
  materialIds: string[],
): Promise<MaterialRow[]> {
  const rows = sortRowsByRequestedIds(
    await getExecutor()
      .select()
      .from(materials)
      .where(inArray(materials.id, materialIds)),
    materialIds,
  );

  if (rows.length !== materialIds.length) {
    throw new AlchemyServiceError('部分材料已耗尽或不存在。');
  }

  for (const row of rows) {
    if (row.cultivatorId !== cultivatorId) {
      throw new AlchemyServiceError('非本人材料，不可动用。', 403);
    }
  }

  return rows;
}

export async function listCultivatorFormulas(
  cultivatorId: string,
): Promise<AlchemyFormula[]> {
  const rows = await getExecutor()
    .select()
    .from(alchemyFormulas)
    .where(eq(alchemyFormulas.cultivatorId, cultivatorId))
    .orderBy(desc(alchemyFormulas.updatedAt));

  return rows.map(mapAlchemyFormulaRow);
}

export async function listCultivatorFormulasPage(
  cultivatorId: string,
  options: FormulaListPageOptions,
): Promise<FormulaListPageResult> {
  const page = Math.max(1, Math.floor(options.page));
  const pageSize = Math.min(5, Math.max(1, Math.floor(options.pageSize)));
  const search = options.search?.trim();
  const conditions = [eq(alchemyFormulas.cultivatorId, cultivatorId)];

  if (options.family) {
    conditions.push(eq(alchemyFormulas.family, options.family));
  }

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(alchemyFormulas.name, pattern),
        ilike(alchemyFormulas.description, pattern),
      )!,
    );
  }

  const whereClause = and(...conditions);
  const [{ count = 0 } = { count: 0 }] = await getExecutor()
    .select({ count: sql<number>`count(*)::int` })
    .from(alchemyFormulas)
    .where(whereClause);
  const total = Number(count) || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(page, totalPages);
  const rows = await getExecutor()
    .select()
    .from(alchemyFormulas)
    .where(whereClause)
    .orderBy(desc(alchemyFormulas.updatedAt))
    .limit(pageSize)
    .offset((normalizedPage - 1) * pageSize);

  return {
    formulas: rows.map(mapAlchemyFormulaRow),
    pagination: {
      page: normalizedPage,
      pageSize,
      total,
      totalPages,
      hasPreviousPage: normalizedPage > 1,
      hasNextPage: normalizedPage < totalPages,
    },
  };
}

export async function deleteCultivatorFormula(
  cultivatorId: string,
  formulaId: string,
): Promise<void> {
  const deletedRows = await getExecutor()
    .delete(alchemyFormulas)
    .where(
      and(
        eq(alchemyFormulas.id, formulaId),
        eq(alchemyFormulas.cultivatorId, cultivatorId),
      ),
    )
    .returning();

  if (deletedRows.length === 0) {
    throw new AlchemyServiceError('未找到这份丹方。', 404);
  }
}

export async function buildDiscoveryCandidate(
  cultivatorId: string,
  context: DiscoveryContext,
): Promise<AlchemyFormulaDiscoveryCandidate | null> {
  const { consumable, materials: materialsList } = context;
  const spec = consumable.spec;
  const batch = spec.alchemyMeta.batch;
  const effectiveDiscoveryStability =
    spec.alchemyMeta.stability +
    (batch && materialsList.length > 1 && batch.synergyScore >= 0.65 ? 8 : 0) -
    (batch?.conflictScore && batch.conflictScore >= 0.65 ? 12 : 0);

  if (
    spec.alchemyMeta.analysisVersion !== 2 ||
    effectiveDiscoveryStability < DISCOVERY_STABILITY_THRESHOLD ||
    (batch?.conflictScore ?? 0) >= 0.65 ||
    spec.operations.length === 0 ||
    spec.alchemyMeta.propertyVector.length === 0
  ) {
    return null;
  }

  const fallbackName = buildFallbackFormulaName(consumable.name);
  const pattern = {
    targetPropertyVector: spec.alchemyMeta.propertyVector,
    dominantElement: spec.alchemyMeta.dominantElement,
    minQuality: getLowestQuality(materialsList),
    slotCount: materialsList.length,
  };
  const blueprint = {
    operations: spec.operations,
    consumeRules: spec.consumeRules,
    targetStability: spec.alchemyMeta.stability,
    targetToxicity: spec.alchemyMeta.toxicityRating,
  };
  const formula: Omit<AlchemyFormula, 'id' | 'createdAt' | 'updatedAt'> = {
    cultivatorId,
    name: fallbackName,
    description: buildFallbackFormulaRecordDescription({
      family: spec.family,
      pattern,
    }),
    family: spec.family,
    pattern,
    blueprint,
    mastery: {
      level: 0,
      exp: 0,
    },
  };

  const signature = buildFormulaSignature(formula);
  const existingFormulas = await listCultivatorFormulas(cultivatorId);
  if (
    existingFormulas.some(
      (existing) => buildFormulaSignature(existing) === signature,
    )
  ) {
    return null;
  }

  const token = crypto.randomUUID();
  const payload: DiscoveryPayload = {
    cultivatorId,
    formula,
    signature,
  };
  await redis.set(
    getDiscoveryKey(cultivatorId, token),
    JSON.stringify(payload),
    'EX',
    DISCOVERY_TTL_SECONDS,
  );

  return {
    token,
    name: formula.name,
    description: formula.description,
    family: formula.family,
    discoveryRemark: buildFallbackDiscoveryRemark(formula.name),
    patternSummary: getPatternSummary(formula.pattern),
  };
}

export async function confirmDiscoveryCandidate(
  cultivatorId: string,
  token: string,
  accept: boolean,
): Promise<{ saved: boolean; formula?: AlchemyFormula }> {
  const key = getDiscoveryKey(cultivatorId, token);
  const payload = parseRedisJson<DiscoveryPayload>(await redis.get(key), key);

  if (!payload) {
    if (!accept) {
      return { saved: false };
    }
    throw new AlchemyServiceError('待确认丹方已散去，可能已过期。', 404);
  }

  if (payload.cultivatorId !== cultivatorId) {
    throw new AlchemyServiceError('此丹意不属于你。', 403);
  }

  if (!accept) {
    await redis.del(key);
    return { saved: false };
  }

  let savedFormula: AlchemyFormula | undefined;
  await getExecutor().transaction(async (tx) => {
    const existingRows = await tx
      .select()
      .from(alchemyFormulas)
      .where(eq(alchemyFormulas.cultivatorId, cultivatorId));
    const existing = existingRows
      .map(mapAlchemyFormulaRow)
      .find((formula) => buildFormulaSignature(formula) === payload.signature);

    if (existing) {
      savedFormula = existing;
      return;
    }

    const [inserted] = await tx
      .insert(alchemyFormulas)
      .values({
        cultivatorId,
        name: payload.formula.name,
        description: payload.formula.description,
        family: payload.formula.family,
        pattern: payload.formula.pattern,
        blueprint: payload.formula.blueprint,
        mastery: payload.formula.mastery,
      })
      .returning();

    savedFormula = mapAlchemyFormulaRow(inserted);
  });

  await redis.del(key);

  return {
    saved: true,
    formula: savedFormula,
  };
}

export async function analyzeFormulaMaterials(
  cultivatorId: string,
  formulaId: string,
  materialIds: string[],
  materialQuantities?: Record<string, number>,
): Promise<FormulaAnalysisResult> {
  const [formula, selectedMaterials] = await Promise.all([
    loadCultivatorFormula(cultivatorId, formulaId),
    loadOwnedMaterials(cultivatorId, materialIds),
  ]);

  let materialsList: PreparedAlchemyMaterial[];
  try {
    materialsList = buildPreparedMaterials(selectedMaterials, materialQuantities);
  } catch (error) {
    if (error instanceof AlchemyServiceError) {
      return {
        analysisId: '',
        valid: false,
        staticBlockingReason: error.message,
        fitScore: 0,
        fitBand: 'poor',
        alignedThreshold: FIT_ALIGNED_THRESHOLD,
        warnings: [],
        materialJudgments: [],
        aggregatedPropertyVector: [],
        dominantElement: formula.pattern.dominantElement,
        stability: 0,
        toxicityRating: 0,
        cooldownRemainingSeconds: 0,
        expiresInSeconds: FORMULA_ANALYSIS_TTL_SECONDS,
      };
    }
    throw error;
  }

  const validation = validateFormulaIngredients(formula, materialsList);
  if (!validation.valid) {
    return {
      analysisId: '',
      valid: false,
      staticBlockingReason: validation.blockingReason,
      fitScore: 0,
      fitBand: 'poor',
      alignedThreshold: FIT_ALIGNED_THRESHOLD,
      warnings: validation.warnings,
      materialJudgments: [],
      aggregatedPropertyVector: [],
      dominantElement: formula.pattern.dominantElement,
      stability: 0,
      toxicityRating: 0,
      cooldownRemainingSeconds: 0,
      expiresInSeconds: FORMULA_ANALYSIS_TTL_SECONDS,
    };
  }

  const cooldown = await checkAndAcquireFormulaAnalysisCooldown(cultivatorId);
  if (!cooldown.allowed) {
    throw new AlchemyServiceError(
      `请 ${cooldown.remainingSeconds} 秒后再推演药路。`,
      429,
      { remainingSeconds: cooldown.remainingSeconds },
    );
  }

  let analysis;
  try {
    analysis = await alchemyFormulaAnalyzer.analyze({
      formula,
      materials: materialsList,
    });
  } catch {
    throw new AlchemyServiceError('药路推演未明，请稍后再试。', 503);
  }

  const payload = buildFormulaAnalysisPayload(
    cultivatorId,
    formula,
    materialsList,
    analysis.plan,
    analysis.materialJudgments,
  );
  const analysisId = crypto.randomUUID();

  await redis.set(
    getFormulaAnalysisKey(cultivatorId, analysisId),
    JSON.stringify(payload),
    'EX',
    FORMULA_ANALYSIS_TTL_SECONDS,
  );

  return {
    analysisId,
    valid: true,
    fitScore: payload.fitScore,
    fitBand: payload.fitBand,
    alignedThreshold: payload.alignedThreshold,
    warnings: payload.warnings,
    materialJudgments: payload.materialJudgments,
    aggregatedPropertyVector: payload.aggregatedPropertyVector,
    batchProfile: payload.batchProfile,
    dominantElement: payload.dominantElement,
    stability: payload.stability,
    toxicityRating: payload.toxicityRating,
    cooldownRemainingSeconds: cooldown.remainingSeconds,
    expiresInSeconds: FORMULA_ANALYSIS_TTL_SECONDS,
  };
}

export async function previewFormulaCraft(
  cultivatorId: string,
  formulaId: string,
  materialIds: string[],
  availableSpiritStones: number,
  fates: PreHeavenFate[] = [],
  materialQuantities?: Record<string, number>,
): Promise<FormulaPreviewResult> {
  const formula = await loadCultivatorFormula(cultivatorId, formulaId);
  const rows = sortRowsByRequestedIds(
    await getExecutor()
      .select()
      .from(materials)
      .where(inArray(materials.id, materialIds)),
    materialIds,
  );

  if (rows.length !== materialIds.length) {
    return {
      cost: { spiritStones: 0 },
      canAfford: true,
      validation: createValidation(false, '部分材料已耗尽或不存在。'),
      batchPreview: buildAlchemyBatchPreview([]),
    };
  }
  if (rows.some((row) => row.cultivatorId !== cultivatorId)) {
    return {
      cost: { spiritStones: 0 },
      canAfford: true,
      validation: createValidation(false, '非本人材料，不可动用。'),
      batchPreview: buildAlchemyBatchPreview([]),
    };
  }

  let materialsList: PreparedAlchemyMaterial[];
  try {
    materialsList = buildPreparedMaterials(rows, materialQuantities);
  } catch (error) {
    if (error instanceof AlchemyServiceError) {
      return {
        cost: { spiritStones: 0 },
        canAfford: true,
        validation: createValidation(false, error.message),
        batchPreview: buildAlchemyBatchPreview([]),
      };
    }
    throw error;
  }

  const highestMaterialRank = calculateHighestMaterialRank(
    rows as Array<{ rank: Quality }>,
  );
  const baseSpiritStones = scaleFateAdjustedValue(
    calculateCraftCost(highestMaterialRank, 'spiritStone'),
    getAlchemySpiritStoneMultiplier(evaluateFateContext(fates)),
  );
  const spiritStones = await SectOrganizationService.applyCraftDiscount(
    cultivatorId,
    baseSpiritStones,
  );

  return {
    cost: { spiritStones },
    canAfford: availableSpiritStones >= spiritStones,
    validation: validateFormulaIngredients(formula, materialsList),
    batchPreview: buildAlchemyBatchPreview(materialsList),
  };
}

export async function craftFromFormula(
  cultivatorId: string,
  formulaId: string,
  materialIds: string[],
  materialQuantities?: Record<string, number>,
  analysisId?: string,
  options: { tx?: DbTransaction; deferSideEffects?: boolean } = {},
): Promise<{
  consumable: Consumable;
  formulaProgress: FormulaProgress;
  afterCommit?: () => Promise<void>;
}> {
  const lockKey = getFormulaLockKey(cultivatorId);
  const acquired = await redis.set(
    lockKey,
    'locked',
    'EX',
    FORMULA_LOCK_TTL_SECONDS,
    'NX',
  );
  if (!acquired) {
    throw new AlchemyServiceError('丹炉已开，道友稍候片刻', 429);
  }

  try {
    const [formula, selectedMaterials, cultivator, fullCultivator, rawAnalysis] =
      await Promise.all([
        loadCultivatorFormula(cultivatorId, formulaId),
        loadOwnedMaterials(cultivatorId, materialIds),
        (options.tx ?? getExecutor())
          .select()
          .from(cultivators)
          .where(eq(cultivators.id, cultivatorId))
          .limit(1)
          .then((rows) => rows[0]),
        getPlayerRuntimeCultivatorByIdUnsafe(cultivatorId, options.tx),
        analysisId
          ? redis.get(getFormulaAnalysisKey(cultivatorId, analysisId))
          : Promise.resolve(null),
      ]);

    if (!cultivator) {
      throw new AlchemyServiceError('道友查无此人', 404);
    }
    if (!analysisId) {
      throw new AlchemyServiceError('请先推演药路。');
    }

    const materialsList = buildPreparedMaterials(
      selectedMaterials,
      materialQuantities,
    );
    const validation = validateFormulaIngredients(formula, materialsList);
    if (!validation.valid) {
      throw new AlchemyServiceError(validation.blockingReason || '丹方不合。');
    }

    const analysisKey = getFormulaAnalysisKey(cultivatorId, analysisId);
    const analysisPayload = parseRedisJson<FormulaAnalysisPayload>(
      rawAnalysis,
      analysisKey,
    );
    if (!analysisPayload) {
      throw new AlchemyServiceError('请先推演药路。');
    }

    const signature = buildFormulaAnalysisSignature(
      cultivatorId,
      formula.id,
      formula.mastery.level,
      materialsList,
    );
    if (
      analysisPayload.cultivatorId !== cultivatorId ||
      analysisPayload.formulaId !== formula.id ||
      analysisPayload.formulaMasteryLevel !== formula.mastery.level ||
      analysisPayload.signature !== signature
    ) {
      throw new AlchemyServiceError('请先推演药路。');
    }

    const highestMaterialRank = calculateHighestMaterialRank(
      selectedMaterials as Array<{ rank: Quality }>,
    );
    const baseCost = scaleFateAdjustedValue(
      calculateCraftCost(highestMaterialRank, 'spiritStone'),
      getAlchemySpiritStoneMultiplier(
        evaluateFateContext(fullCultivator?.cultivator.pre_heaven_fates ?? []),
      ),
    );
    const cost = await SectOrganizationService.applyCraftDiscount(
      cultivatorId,
      baseCost,
      options.tx ?? getExecutor(),
    );
    if ((cultivator.spirit_stones ?? 0) < cost) {
      throw new AlchemyServiceError(`灵石不足，需要 ${cost} 枚`);
    }

    const aggregated = aggregateAlchemyProperties(
      materialsList,
      analysisPayload.plan,
    );
    const fit = calculatePropertyVectorFit(
      aggregated.rawPropertyVector,
      formula.pattern.targetPropertyVector,
    );
    const fitBand = determineFormulaFitBand(fit);
    if (
      fitBand !== analysisPayload.fitBand ||
      Math.abs(fit - analysisPayload.fitScore) > 0.0001
    ) {
      throw new AlchemyServiceError('请先推演药路。');
    }
    const batchProfile = buildAlchemyBatchProfile(materialsList, aggregated, {
      formulaFitBand: fitBand,
      formulaFitScore: fit,
      materialJudgments: analysisPayload.materialJudgments,
    });

    const dominantElement = aggregated.dominantElement;
    const fitBandPenaltyFactor =
      fitBand === 'poor'
        ? calculatePoorPenaltyFactor(fit)
        : fitBand === 'degraded'
          ? calculateDegradedPenaltyFactor(fit)
          : 1;
    const fitMultiplier = Number(
      (
        calculateFormulaFitMultiplier(
          formula,
          aggregated.rawPropertyVector,
          dominantElement,
          materialsList,
        ) * fitBandPenaltyFactor
      ).toFixed(4),
    );
    const appearanceStabilityPenalty =
      fitBand === 'poor'
        ? Math.round((FIT_POOR_THRESHOLD - fit) * 120 + 28)
        : fitBand === 'degraded'
          ? Math.round((FIT_ALIGNED_THRESHOLD - fit) * 35)
          : 0;
    const appearanceMasteryLevel =
      fitBand === 'poor'
        ? 0
        : fitBand === 'degraded'
          ? Math.max(0, Math.floor(formula.mastery.level / 2))
          : formula.mastery.level;
    const appearance = rollPillAppearance({
      stability: Math.max(
        0,
        aggregated.stability +
          batchProfile.stabilityDelta -
          appearanceStabilityPenalty,
      ),
      propertyVector: formula.pattern.targetPropertyVector,
      masteryLevel: appearanceMasteryLevel,
    });
    const operations = appendFormulaPositiveToxicity(
      applyPillAppearanceToOperations(
        scaleFormulaOperations(
          formula.blueprint.operations,
          fitMultiplier,
          highestMaterialRank,
          formula.pattern.minQuality,
        ),
        appearance,
      ),
      highestMaterialRank,
      appearance,
      formula.pattern.targetPropertyVector,
    );
    const masteryBonusStability = formula.mastery.level * 2;
    const masteryBonusToxicity = formula.mastery.level;
    const degradedStabilityPenalty =
      fitBand === 'degraded'
        ? Math.round((FIT_ALIGNED_THRESHOLD - fit) * 40)
        : 0;
    const poorStabilityPenalty =
      fitBand === 'poor'
        ? Math.round((FIT_POOR_THRESHOLD - fit) * 120 + 25)
        : 0;
    const degradedToxicityPenalty =
      fitBand === 'degraded'
        ? Math.round((FIT_ALIGNED_THRESHOLD - fit) * 30)
        : 0;
    const poorToxicityPenalty =
      fitBand === 'poor'
        ? Math.round((FIT_POOR_THRESHOLD - fit) * 120 + 35)
        : 0;
    const spec: PillSpec = {
      kind: 'pill',
      family: formula.family,
      operations,
      consumeRules: {
        ...formula.blueprint.consumeRules,
        quotaCategory: getQuotaCategoryForFamily(formula.family),
      },
      alchemyMeta: {
        source: 'formula',
        formulaId: formula.id,
        sourceMaterials: materialsList.map((material) => material.name),
        analysisVersion: 2,
        propertyVector: formula.pattern.targetPropertyVector,
        sourceMaterialVectors: aggregated.sourceMaterialVectors,
        fitScore: fit,
        fitBand,
        fitMultiplier,
        dominantElement: formula.pattern.dominantElement ?? dominantElement,
        stability: clamp(
          formula.blueprint.targetStability +
            masteryBonusStability -
            degradedStabilityPenalty -
            poorStabilityPenalty +
            batchProfile.stabilityDelta,
          15,
          95,
        ),
        toxicityRating: clamp(
          formula.blueprint.targetToxicity -
            masteryBonusToxicity +
            degradedToxicityPenalty +
            poorToxicityPenalty +
            batchProfile.toxicityDelta,
          0,
          100,
        ),
        appearance,
        tags: buildAlchemyPropertyTags(
          formula.pattern.targetPropertyVector,
          formula.family,
        ),
        batch: batchProfile,
      },
    };
    const breakthroughTargetRealm =
      formula.family === 'breakthrough'
        ? getNextMajorRealm(cultivator.realm as RealmType)
        : null;
    const usesFixedBreakthroughName =
      formula.family === 'breakthrough' &&
      breakthroughTargetRealm !== null &&
      hasBreakthroughFocusEffect(spec.operations);
    if (usesFixedBreakthroughName) {
      spec.alchemyMeta.breakthroughTargetRealm = breakthroughTargetRealm;
      spec.alchemyMeta.breakthroughLabel = getBreakthroughPillLabel(
        breakthroughTargetRealm,
      );
    } else if (formula.family === 'breakthrough' && breakthroughTargetRealm) {
      spec.alchemyMeta.breakthroughTargetRealm = breakthroughTargetRealm;
    }
    const consumable: Consumable = {
      name: usesFixedBreakthroughName
        ? getBreakthroughPillLabel(breakthroughTargetRealm)
        : getFormulaProductName(formula.name),
      type: '丹药',
      quality: highestMaterialRank,
      quantity: batchProfile.yieldQuantity,
      description: buildFormulaDescription(
        formula,
        materialsList.map((material) => material.name),
        spec.alchemyMeta.stability,
        spec.alchemyMeta.toxicityRating,
        fit,
        fitMultiplier,
        fitBand,
      ),
      score: 0,
      spec,
    };
    consumable.score = calculateSingleElixirScore(consumable);

    const { next: nextMastery, progress } = advanceFormulaMastery(
      formula.mastery,
      fit,
      fitBand,
    );

    const writeFormulaCraft = async (tx: DbTransaction) => {
      for (const material of materialsList) {
        const row = selectedMaterials.find((item) => item.id === material.id);
        if (!row) {
          throw new AlchemyServiceError('材料记录异常，无法扣除', 500);
        }

        if (material.dose >= row.quantity) {
          await tx.delete(materials).where(eq(materials.id, material.id));
        } else {
          await tx
            .update(materials)
            .set({ quantity: row.quantity - material.dose })
            .where(eq(materials.id, material.id));
        }
      }

      await tx
        .update(cultivators)
        .set({ spirit_stones: (cultivator.spirit_stones ?? 0) - cost })
        .where(eq(cultivators.id, cultivatorId));

      await addConsumableToInventory(
        cultivator.userId,
        cultivatorId,
        consumable,
        tx,
      );

      await tx
        .update(alchemyFormulas)
        .set({ mastery: nextMastery })
        .where(eq(alchemyFormulas.id, formula.id));
    };

    if (options.tx) {
      await writeFormulaCraft(options.tx);
    } else {
      await getExecutor().transaction(writeFormulaCraft);
    }
    const afterCommit = async () => {
      await redis.del(analysisKey);
    };
    if (!options.deferSideEffects) {
      await afterCommit();
    }

    const inserted = await (options.tx ?? getExecutor())
      .select()
      .from(consumables)
      .where(
        and(
          eq(consumables.cultivatorId, cultivatorId),
          eq(consumables.name, consumable.name),
          eq(consumables.quality, highestMaterialRank),
          eq(consumables.type, consumable.type),
        ),
      )
      .limit(20);

    const insertedRow = inserted.find((row) => {
      try {
        return (
          serializeConsumableSpec(row.spec as Consumable['spec']) ===
          serializeConsumableSpec(spec)
        );
      } catch {
        return false;
      }
    });

    return {
      consumable: insertedRow
        ? mapConsumableCraftResult(insertedRow, consumable.quantity)
        : consumable,
      formulaProgress: progress,
      afterCommit: options.deferSideEffects ? afterCommit : undefined,
    };
  } finally {
    await redis.del(lockKey);
  }
}
