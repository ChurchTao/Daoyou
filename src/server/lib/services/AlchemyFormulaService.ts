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
  buildAlchemyPreviewWarnings,
  buildAlchemyPropertyTags,
  calculatePropertyVectorFit,
  chooseDominantElement,
  getQuotaCategoryForFamily,
  type PreparedAlchemyMaterial,
} from '@server/lib/services/AlchemyRecipeRules';
import { calculateSingleElixirScore } from '@server/utils/rankingUtils';
import {
  calculateCraftCost,
  calculateHighestMaterialRank,
} from '@shared/engine/creation-v2/CraftCostCalculator';
import {
  buildCultivationGain,
  buildInsightGain,
  scaleProgressGain,
} from '@shared/lib/alchemyProgress';
import {
  formatAlchemyPropertyVector,
  sortWeightedAlchemyProperties,
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
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';
import type {
  AlchemyFormula,
  AlchemyFormulaDiscoveryCandidate,
  AlchemyFormulaMastery,
  AlchemyFormulaPattern,
  AlchemyRecipePlan,
  ConditionOperation,
  FormulaAnalysisResult,
  FormulaFitBand,
  FormulaMaterialJudgment,
  PillSpec,
  WeightedAlchemyProperty,
} from '@shared/types/consumable';
import type { Consumable, PreHeavenFate } from '@shared/types/cultivator';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { alchemyFormulaAnalyzer } from './AlchemyFormulaAnalyzer';
import { AlchemyServiceError } from './AlchemyServiceError';
import {
  mapConsumableRow,
  serializeConsumableSpec,
} from './consumablePersistence';
import {
  addConsumableToInventory,
  getCultivatorByIdUnsafe,
} from './cultivatorService';
import { getMysteryMaterialBlockingReason } from './materialMysteryGuard';

const DISCOVERY_TTL_SECONDS = 600;
const FORMULA_ANALYSIS_TTL_SECONDS = 600;
const FORMULA_ANALYSIS_COOLDOWN_SECONDS = 30;
const FORMULA_LOCK_TTL_SECONDS = 30;
const DISCOVERY_STABILITY_THRESHOLD = 70;
const FIT_ALIGNED_THRESHOLD = 0.65;
const FIT_BLOCK_THRESHOLD_BASE = 0.45;
const FIT_BLOCK_THRESHOLD_MIN = 0.3;
const FIT_BLOCK_THRESHOLD_STEP = 0.015;
const DEGRADED_PENALTY_FACTOR_MIN = 0.78;
const DEGRADED_PENALTY_FACTOR_MAX = 0.9;

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
}

export interface FormulaProgress {
  previousLevel: number;
  level: number;
  exp: number;
  gainedExp: number;
  leveledUp: boolean;
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
  hardBlockThreshold: number;
  alignedThreshold: number;
  warnings: string[];
  materialJudgments: FormulaMaterialJudgment[];
  aggregatedPropertyVector: WeightedAlchemyProperty[];
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
      targetPropertyVector: sortWeightedAlchemyProperties(
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
  fitBand: Exclude<FormulaFitBand, 'blocked'>,
): string {
  const lines = [
    `依《${formula.name}》炉意炼成，以${sourceMaterials.join('、')}合炉。`,
    `成丹稳度 ${stability}，药力拟合 ${(fitMultiplier * 100).toFixed(0)}%，丹毒评定 ${toxicityRating}。`,
  ];

  if (fitBand === 'degraded') {
    lines.push('本炉循方成丹，但药力散逸，终究未尽合丹方原意。');
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
  if (!material.element) {
    throw new AlchemyServiceError(`材料 ${material.name} 缺少五行属性`, 400);
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
    element: material.element as ElementType,
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

function calculateFormulaHardBlockThreshold(masteryLevel: number): number {
  return clamp(
    FIT_BLOCK_THRESHOLD_BASE - masteryLevel * FIT_BLOCK_THRESHOLD_STEP,
    FIT_BLOCK_THRESHOLD_MIN,
    FIT_BLOCK_THRESHOLD_BASE,
  );
}

function determineFormulaFitBand(
  fitScore: number,
  hardBlockThreshold: number,
): FormulaFitBand {
  if (fitScore >= FIT_ALIGNED_THRESHOLD) {
    return 'aligned';
  }
  if (fitScore < hardBlockThreshold) {
    return 'blocked';
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
  const warnings = buildAlchemyPreviewWarnings(materialsList);
  const currentDominantElement = chooseDominantElement(materialsList);

  if (
    formula.pattern.dominantElement &&
    currentDominantElement !== formula.pattern.dominantElement
  ) {
    warnings.push('本炉主元素偏离丹方原意，成丹拟合会略有折损。');
  }

  return warnings;
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
    targetPropertyVector: sortWeightedAlchemyProperties(
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
  const hardBlockThreshold = calculateFormulaHardBlockThreshold(
    formula.mastery.level,
  );
  const fitBand = determineFormulaFitBand(fitScore, hardBlockThreshold);
  const warnings = buildFormulaWarnings(formula, materialsList);

  if (fitBand === 'degraded') {
    warnings.push('本炉虽可循方，但药力散逸较多，成丹后多半只得勉强之品。');
  } else if (fitBand === 'blocked') {
    warnings.push('当前炉材与丹方主路相冲，强行开炉极易炸鼎。');
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
    hardBlockThreshold,
    alignedThreshold: FIT_ALIGNED_THRESHOLD,
    warnings,
    materialJudgments: sortMaterialJudgments(materialJudgments),
    aggregatedPropertyVector: aggregated.rawPropertyVector,
    dominantElement: aggregated.dominantElement,
    stability: aggregated.stability,
    toxicityRating: aggregated.toxicityRating,
  };
}

function scaleFormulaOperations(
  operations: ConditionOperation[],
  fitMultiplier: number,
  quality: Quality,
  cultivationContext: {
    realm: RealmType;
    realmStage?: RealmStage;
    expCap?: number;
  },
): ConditionOperation[] {
  return operations.map((operation) => {
    if (operation.type === 'restore_resource') {
      return scaleRestoreOperationValue(operation, fitMultiplier);
    }

    if (operation.type === 'gain_progress') {
      const baseValue =
        operation.target === 'cultivation_exp'
          ? buildCultivationGain({
              ...cultivationContext,
              quality,
              fitMultiplier,
            })
          : buildInsightGain(quality);
      return {
        ...operation,
        value:
          operation.target === 'cultivation_exp'
            ? baseValue
            : scaleProgressGain(baseValue, fitMultiplier),
      };
    }

    if (
      operation.type === 'remove_status' &&
      (operation.status === 'minor_wound' ||
        operation.status === 'major_wound' ||
        operation.status === 'near_death')
    ) {
      return {
        ...operation,
        status: getHealingCuredStatus(quality),
      };
    }

    if (operation.type === 'advance_track') {
      return {
        ...operation,
        value: Math.max(1, Math.floor(operation.value * fitMultiplier)),
      };
    }

    if (operation.type === 'increase_lifespan') {
      return {
        ...operation,
        value: Math.max(1, Math.floor(operation.value * fitMultiplier)),
      };
    }

    return operation;
  });
}

export function advanceFormulaMastery(mastery: AlchemyFormulaMastery): {
  next: AlchemyFormulaMastery;
  progress: FormulaProgress;
} {
  let level = mastery.level;
  let exp = mastery.exp + 1;

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
      gainedExp: 1,
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

  if (
    spec.alchemyMeta.analysisVersion !== 2 ||
    spec.alchemyMeta.stability < DISCOVERY_STABILITY_THRESHOLD ||
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
        fitBand: 'blocked',
        hardBlockThreshold: calculateFormulaHardBlockThreshold(
          formula.mastery.level,
        ),
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
      fitBand: 'blocked',
      hardBlockThreshold: calculateFormulaHardBlockThreshold(
        formula.mastery.level,
      ),
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
      `请 ${cooldown.remainingSeconds} 秒后再按方辨材。`,
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
    throw new AlchemyServiceError('丹方炉意未明，请稍后再试。', 503);
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
    hardBlockThreshold: payload.hardBlockThreshold,
    alignedThreshold: payload.alignedThreshold,
    warnings: payload.warnings,
    materialJudgments: payload.materialJudgments,
    aggregatedPropertyVector: payload.aggregatedPropertyVector,
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
    };
  }
  if (rows.some((row) => row.cultivatorId !== cultivatorId)) {
    return {
      cost: { spiritStones: 0 },
      canAfford: true,
      validation: createValidation(false, '非本人材料，不可动用。'),
    };
  }

  let materialsList: PreparedAlchemyMaterial[];
  try {
    materialsList = buildPreparedMaterials(rows);
  } catch (error) {
    if (error instanceof AlchemyServiceError) {
      return {
        cost: { spiritStones: 0 },
        canAfford: true,
        validation: createValidation(false, error.message),
      };
    }
    throw error;
  }

  const highestMaterialRank = calculateHighestMaterialRank(
    rows as Array<{ rank: Quality }>,
  );
  const spiritStones = scaleFateAdjustedValue(
    calculateCraftCost(highestMaterialRank, 'spiritStone'),
    getAlchemySpiritStoneMultiplier(evaluateFateContext(fates)),
  );

  return {
    cost: { spiritStones },
    canAfford: availableSpiritStones >= spiritStones,
    validation: validateFormulaIngredients(formula, materialsList),
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
        getCultivatorByIdUnsafe(cultivatorId, options.tx),
        analysisId
          ? redis.get(getFormulaAnalysisKey(cultivatorId, analysisId))
          : Promise.resolve(null),
      ]);

    if (!cultivator) {
      throw new AlchemyServiceError('道友查无此人', 404);
    }
    if (!analysisId) {
      throw new AlchemyServiceError('请先按方辨材。');
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
      throw new AlchemyServiceError('请先按方辨材。');
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
      throw new AlchemyServiceError('请先按方辨材。');
    }

    const highestMaterialRank = calculateHighestMaterialRank(
      selectedMaterials as Array<{ rank: Quality }>,
    );
    const cost = scaleFateAdjustedValue(
      calculateCraftCost(highestMaterialRank, 'spiritStone'),
      getAlchemySpiritStoneMultiplier(
        evaluateFateContext(fullCultivator?.cultivator.pre_heaven_fates ?? []),
      ),
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
    const fitBand = determineFormulaFitBand(
      fit,
      analysisPayload.hardBlockThreshold,
    );
    if (
      fitBand !== analysisPayload.fitBand ||
      Math.abs(fit - analysisPayload.fitScore) > 0.0001
    ) {
      throw new AlchemyServiceError('请先按方辨材。');
    }
    if (fitBand === 'blocked') {
      throw new AlchemyServiceError(
        '本炉药性与丹方偏差过大，强行开炉只会炸鼎。',
      );
    }

    const dominantElement = aggregated.dominantElement;
    const degradedPenaltyFactor =
      fitBand === 'degraded' ? calculateDegradedPenaltyFactor(fit) : 1;
    const fitMultiplier = Number(
      (
        calculateFormulaFitMultiplier(
          formula,
          aggregated.rawPropertyVector,
          dominantElement,
          materialsList,
        ) * degradedPenaltyFactor
      ).toFixed(4),
    );
    const masteryBonusStability = formula.mastery.level * 2;
    const masteryBonusToxicity = formula.mastery.level;
    const degradedStabilityPenalty =
      fitBand === 'degraded'
        ? Math.round((FIT_ALIGNED_THRESHOLD - fit) * 40)
        : 0;
    const degradedToxicityPenalty =
      fitBand === 'degraded'
        ? Math.round((FIT_ALIGNED_THRESHOLD - fit) * 30)
        : 0;
    const cultivationProgress = cultivator.cultivation_progress as
      | { exp_cap?: number }
      | null
      | undefined;
    const spec: PillSpec = {
      kind: 'pill',
      family: formula.family,
      operations: scaleFormulaOperations(
        formula.blueprint.operations,
        fitMultiplier,
        highestMaterialRank,
        {
          realm: cultivator.realm as RealmType,
          realmStage: (cultivator.realm_stage ?? '初期') as RealmStage,
          expCap: cultivationProgress?.exp_cap,
        },
      ),
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
            degradedStabilityPenalty,
          15,
          95,
        ),
        toxicityRating: clamp(
          formula.blueprint.targetToxicity -
            masteryBonusToxicity +
            degradedToxicityPenalty,
          0,
          100,
        ),
        tags: buildAlchemyPropertyTags(
          formula.pattern.targetPropertyVector,
          formula.family,
        ),
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
      quantity: 1,
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
      consumable: insertedRow ? mapConsumableRow(insertedRow) : consumable,
      formulaProgress: progress,
      afterCommit: options.deferSideEffects ? afterCommit : undefined,
    };
  } finally {
    await redis.del(lockKey);
  }
}
