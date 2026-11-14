import { type ElementType } from '@daoyou/constants/elements';
import { QUALITY_ORDER, type Quality } from '@daoyou/constants/qualities';
import { type RealmType } from '@daoyou/constants/realms';
import type { PlayerResourceMutationMeta } from '@daoyou/contracts/player';
import {
  ALCHEMY_MAX_DOSE,
  getFormulaFitPolicy,
} from '@daoyou/game-content/alchemy';
import type { Consumable, PreHeavenFate } from '@daoyou/game-domain/character';
import type {
  AlchemyBatchDisplayProfile,
  AlchemyBatchProfile,
  AlchemyFormula,
  AlchemyFormulaBlueprint,
  AlchemyFormulaDiscoveryCandidate,
  AlchemyFormulaMastery,
  AlchemyFormulaPattern,
  AlchemyRecipePlan,
  FormulaAnalysisResult,
  FormulaFitBand,
  FormulaMaterialJudgment,
  PillFamily,
  PillSpec,
  WeightedAlchemyProperty,
} from '@daoyou/game-domain/consumables';
import { PILL_QUOTA_CATEGORY_VALUES } from '@daoyou/game-domain/consumables';
import { type MaterialType } from '@daoyou/game-domain/inventory';
import type { ResourceOperationSettlement } from '@daoyou/game-domain/resources';
import {
  buildAlchemyYieldPreview,
  calculateAlchemyAnalysisQiCost,
  calculateAlchemyCost,
  calculateAlchemyCraftQiCost,
  calculateAlchemyQiCost,
  calculateHighestMaterialRank,
  formatAlchemyPropertyVector,
  isAlchemyMaterialType,
  normalizeAlchemyEffectRoute,
  normalizeWeightedAlchemyProperties,
  rollAlchemyYieldProfile,
  toAlchemyYieldDisplayProfile,
  validateAlchemyEffectRoute,
  type AlchemyYieldFactors,
} from '@daoyou/game-rules/alchemy';
import {
  evaluateFateContext,
  getAlchemySpiritStoneMultiplier,
  scaleFateAdjustedCost,
} from '@daoyou/game-rules/character/fates';
import {
  getBreakthroughPillLabel,
  getNextMajorRealm,
} from '@daoyou/game-rules/consumables/breakthrough';
import type { AlchemyBagMaterial } from '@daoyou/game-rules/inventory/alchemy';
import type { AiService } from '@nestjs/ai';
import { AlchemyFormulaAnalyzer } from '@server/alchemy/application/AlchemyFormulaAnalyzer.js';
import {
  aggregateAlchemyProperties,
  buildAlchemyBatchProfile,
  buildAlchemyPropertyTags,
  getQuotaCategoryForFamily,
  type PreparedAlchemyMaterial,
} from '@server/alchemy/application/AlchemyRecipeRules.js';
import { AlchemyServiceError } from '@server/alchemy/application/AlchemyServiceError.js';
import {
  consumeAlchemyMaterials,
  grantAlchemyOutput,
  loadAlchemyMaterials,
} from '@server/alchemy/application/inventory/AlchemyInventory.js';
import {
  assembleAlchemyOutputConsumables,
  type AlchemyOutputDraft,
} from '@server/alchemy/application/inventory/AlchemyOutputAssembler.js';
import { qiCurrencyChange } from '@server/cultivator/application/QiResourceChanges.js';
import { QiService } from '@server/cultivator/application/QiService.js';
import { getCultivatorPreHeavenFates } from '@server/cultivator/application/readers/CultivatorProfileRepository.js';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import {
  alchemyFormulas,
  cultivators,
  playerMutationRequests,
} from '@server/lib/drizzle/schema.js';
import { redis } from '@server/lib/redis/index.js';
import { parseRedisJson } from '@server/lib/redis/json.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import {
  findPlayerMutationRequest,
  insertPlayerMutationRequest,
  readScopeVersion,
} from '@server/lib/repositories/playerStateRepository.js';
import {
  playerCommandExecutor,
  type CommittedCommand,
} from '@server/player/application/state/CommandExecutors.js';
import { sectOrganizationFacade } from '@server/sects/organization/index.js';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { assertAlchemyMaterialVersions } from './inventory/AlchemyInventory.js';

const DISCOVERY_TTL_SECONDS = 600;
const FORMULA_ANALYSIS_TTL_SECONDS = 600;
const FORMULA_ANALYSIS_COOLDOWN_SECONDS = 30;
// Bump when analysis prompt, schema or interpretation changes.
const FORMULA_ANALYSIS_CACHE_VERSION = 3;
const ANALYSIS_RESERVE_SOURCE = 'alchemy_formula_analysis_reserve';
const ANALYSIS_SOURCE = 'alchemy_formula_analysis';
const ANALYSIS_CONSUMED_SOURCE = 'alchemy_formula_analysis_consumed';
const DISCOVERY_STABILITY_THRESHOLD = 70;

type MaterialRow = AlchemyBagMaterial;

type AlchemyFormulaRow = typeof alchemyFormulas.$inferSelect;

export interface FormulaPreviewResult {
  cost: {
    spiritStones: number;
    qi: number;
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
  conclusion: string;
  warnings: string[];
  materialJudgments: FormulaMaterialJudgment[];
  batchProfile: AlchemyBatchProfile;
  dominantElement: ElementType;
  qiCostPaid?: number;
  expiresAt?: number;
  contextSignature?: string;
  modelKey?: string;
}

type FormulaAnalysisOutcome =
  | { status: 'ready'; analysisId: string; payload: FormulaAnalysisPayload }
  | { status: 'failed'; message: string };

type FormulaAnalysisInput = {
  requestId: string;
  materialIds: string[];
  materialVersions: Record<string, string>;
  materialQuantities?: Record<string, number>;
};

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

function toAlchemyBatchDisplayProfile(
  profile: AlchemyBatchProfile,
  materials: PreparedAlchemyMaterial[],
  factors: AlchemyYieldFactors,
): AlchemyBatchDisplayProfile {
  const preview = buildAlchemyYieldPreview({
    materials,
    factors,
  });
  return {
    compoundTier: profile.compoundTier,
    roleSummary: profile.roleSummary,
    totalQuantityRange: preview.totalQuantityRange,
    primaryQualityRange: preview.primaryQualityRange,
    possibleQualities: preview.possibleQualities,
    appearanceHints: preview.appearanceHints,
    essenceLossRatioRange: preview.essenceLossRatioRange,
    summary: profile.roleSummary,
    warnings: [],
  };
}

function normalizeDose(
  material: MaterialRow,
  materialQuantities?: Record<string, number>,
): number {
  const requested = materialQuantities?.[material.id] ?? 1;
  if (requested > ALCHEMY_MAX_DOSE)
    throw new AlchemyServiceError(
      `每个材料格最多投入 ${ALCHEMY_MAX_DOSE} 份。`,
      400,
    );
  if (
    !Number.isInteger(requested) ||
    requested < 1 ||
    requested > material.quantity
  ) {
    throw new AlchemyServiceError(
      `材料 ${material.name} 数量不足，请重新备料。`,
      409,
    );
  }
  return requested;
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

function parseFormulaBlueprintV4(blueprint: unknown): AlchemyFormulaBlueprint {
  if (!blueprint || typeof blueprint !== 'object') {
    throw new AlchemyServiceError('丹方蓝图已损坏，请重新悟方。', 500);
  }
  const record = blueprint as Record<string, unknown>;
  if (record.version !== 4) {
    throw new AlchemyServiceError('此丹方需要升级后才能使用。', 409);
  }
  const consumeRules = record.consumeRules as
    Record<string, unknown> | undefined;
  if (
    !consumeRules ||
    consumeRules.scene !== 'out_of_battle_only' ||
    !PILL_QUOTA_CATEGORY_VALUES.includes(
      consumeRules.quotaCategory as (typeof PILL_QUOTA_CATEGORY_VALUES)[number],
    )
  ) {
    throw new AlchemyServiceError('丹方服用规则已损坏，请重新悟方。', 500);
  }
  if (
    !Number.isFinite(record.targetStability) ||
    !Number.isFinite(record.targetToxicity)
  ) {
    throw new AlchemyServiceError('丹方稳定度数据已损坏，请重新悟方。', 500);
  }
  const needsRebirth = record.needsRebirth === true;
  const route = record.route as AlchemyFormulaBlueprint['route'];
  if (!needsRebirth) {
    try {
      validateAlchemyEffectRoute(route);
    } catch {
      throw new AlchemyServiceError('丹方药性路线已损坏，请重新悟方。', 500);
    }
  }
  return {
    version: 4,
    route,
    needsRebirth: needsRebirth || undefined,
    consumeRules: {
      scene: 'out_of_battle_only',
      quotaCategory:
        consumeRules.quotaCategory as AlchemyFormulaBlueprint['consumeRules']['quotaCategory'],
    },
    targetStability: record.targetStability as number,
    targetToxicity: record.targetToxicity as number,
  };
}

function mapAlchemyFormulaRow(row: AlchemyFormulaRow): AlchemyFormula {
  if (!isValidFormulaPattern(row.pattern)) {
    throw new AlchemyServiceError('丹方数据已损坏，请删除后重新悟方。', 500);
  }
  const blueprint = parseFormulaBlueprintV4(row.blueprint);

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
    blueprint,
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

function getFormulaAnalysisKey(
  cultivatorId: string,
  analysisId: string,
): string {
  return `alchemy:formula_analysis:${cultivatorId}:${analysisId}`;
}

function getFormulaAnalysisCooldownKey(cultivatorId: string): string {
  return `alchemy:formula_analysis:cooldown:${cultivatorId}`;
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
      typeof ttl === 'number' && ttl > 0
        ? ttl
        : FORMULA_ANALYSIS_COOLDOWN_SECONDS,
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
      name: material.name,
      rank: material.rank,
      type: material.type,
      element: material.element,
      description: material.description,
    })),
  });
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

  return createValidation(true);
}

export function buildFormulaSignature(
  formula: Pick<AlchemyFormula, 'family' | 'pattern' | 'blueprint'>,
): string {
  return stableStringify({
    family: formula.family,
    route: formula.blueprint.route,
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

function calculateFormulaFitMultiplier(
  formula: AlchemyFormula,
  fitBand: FormulaFitBand,
  dominantElement: ElementType,
  materialsList: PreparedAlchemyMaterial[],
): number {
  const policy = getFormulaFitPolicy(fitBand);
  const elementBonus =
    formula.pattern.dominantElement &&
    dominantElement === formula.pattern.dominantElement
      ? 0.05
      : 0;
  const qualityBonus =
    countMaterialsAboveMinQuality(materialsList, formula.pattern.minQuality) *
    0.02;

  return clamp(
    policy.baseMultiplier + elementBonus + qualityBonus,
    policy.minMultiplier,
    policy.maxMultiplier,
  );
}

function resolveFormulaCraftProjection(
  formula: AlchemyFormula,
  materialsList: PreparedAlchemyMaterial[],
  analysis: Pick<
    FormulaAnalysisPayload,
    'fitBand' | 'batchProfile' | 'dominantElement'
  >,
): {
  fitMultiplier: number;
  stability: number;
  toxicityRating: number;
  yieldFactors: AlchemyYieldFactors;
} {
  const policy = getFormulaFitPolicy(analysis.fitBand);
  const fitMultiplier = Number(
    calculateFormulaFitMultiplier(
      formula,
      analysis.fitBand,
      analysis.dominantElement,
      materialsList,
    ).toFixed(4),
  );
  const stability = clamp(
    formula.blueprint.targetStability +
      formula.mastery.level * 2 -
      policy.stabilityPenalty +
      analysis.batchProfile.stabilityDelta,
    15,
    95,
  );
  const toxicityRating = clamp(
    formula.blueprint.targetToxicity -
      formula.mastery.level +
      policy.toxicityPenalty +
      analysis.batchProfile.toxicityDelta,
    0,
    100,
  );
  return {
    fitMultiplier,
    stability,
    toxicityRating,
    yieldFactors: {
      synergyScore: analysis.batchProfile.synergyScore,
      conflictScore: analysis.batchProfile.conflictScore,
      fitMultiplier,
      stability,
      purity: analysis.batchProfile.essenceSummary?.purity,
      masteryLevel: formula.mastery.level,
      minQuality: formula.pattern.minQuality,
    },
  };
}

function buildFormulaAnalysisPayload(
  cultivatorId: string,
  formula: AlchemyFormula,
  materialsList: PreparedAlchemyMaterial[],
  plan: AlchemyRecipePlan,
  fitBand: FormulaFitBand,
  conclusion: string,
  materialJudgments: FormulaMaterialJudgment[],
): FormulaAnalysisPayload {
  const aggregated = aggregateAlchemyProperties(materialsList, plan);
  const fitScore = getFormulaFitPolicy(fitBand).score;
  const batchProfile = buildAlchemyBatchProfile(materialsList, aggregated, {
    formulaFitBand: fitBand,
    materialJudgments,
  });
  const warnings: string[] = [];

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
    conclusion,
    warnings,
    materialJudgments: sortMaterialJudgments(materialJudgments),
    batchProfile,
    dominantElement: aggregated.dominantElement,
  };
}

export function advanceFormulaMastery(
  mastery: AlchemyFormulaMastery,
  fitBand: FormulaFitBand = 'aligned',
): {
  next: AlchemyFormulaMastery;
  progress: FormulaProgress;
} {
  const gainedExp = getFormulaFitPolicy(fitBand).masteryGain;
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
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<AlchemyFormula> {
  const [row] = await q
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

const loadOwnedMaterials = loadAlchemyMaterials;

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
  const propertyVector = spec.alchemyMeta.propertyVector;
  const effectiveDiscoveryStability =
    spec.alchemyMeta.stability +
    (batch && materialsList.length > 1 && batch.synergyScore >= 0.65 ? 8 : 0) -
    (batch?.conflictScore && batch.conflictScore >= 0.65 ? 12 : 0);

  if (
    spec.alchemyMeta.analysisVersion !== 2 ||
    !Array.isArray(propertyVector) ||
    effectiveDiscoveryStability < DISCOVERY_STABILITY_THRESHOLD ||
    (batch?.conflictScore ?? 0) >= 0.65 ||
    spec.operations.length === 0 ||
    propertyVector.length === 0
  ) {
    return null;
  }

  const fallbackName = buildFallbackFormulaName(consumable.name);
  const pattern = {
    targetPropertyVector: propertyVector,
    dominantElement: spec.alchemyMeta.dominantElement,
    minQuality: getLowestQuality(materialsList),
    slotCount: materialsList.length,
  };
  const blueprint = {
    version: 4 as const,
    route: validateAlchemyEffectRoute(
      normalizeAlchemyEffectRoute({ effects: propertyVector }),
    ),
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

function analysisHash(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

async function analysisState(
  cultivatorId: string,
): Promise<PlayerResourceMutationMeta> {
  const scope = { kind: 'cultivator' as const, id: cultivatorId };
  return {
    changes: [],
    baselines: [{ scope, scopeVersion: await readScopeVersion(scope) }],
  };
}

async function loadAnalysisContext(
  cultivatorId: string,
  formulaId: string,
  input: FormulaAnalysisInput,
  modelKey: string,
  q: DbExecutor = getExecutor(),
) {
  await assertAlchemyMaterialVersions(
    cultivatorId,
    input.materialIds,
    input.materialVersions,
    q,
  );
  const formula = await loadCultivatorFormula(cultivatorId, formulaId, q);
  const rows = await loadOwnedMaterials(cultivatorId, input.materialIds, q);
  const materials = buildPreparedMaterials(rows, input.materialQuantities);
  const validation = validateFormulaIngredients(formula, materials);
  if (!validation.valid)
    throw new AlchemyServiceError(validation.blockingReason || '丹方不合。');
  if (formula.blueprint.needsRebirth)
    throw new AlchemyServiceError('此丹方需要升级后才能炼制。', 409);
  return {
    formula,
    materials,
    signature: analysisHash({
      version: FORMULA_ANALYSIS_CACHE_VERSION,
      modelKey,
      formula,
      materials,
      materialVersions: input.materialVersions,
    }),
  };
}

async function readAnalysisOutcome(cultivatorId: string, requestId: string) {
  const record = await findPlayerMutationRequest(
    cultivatorId,
    ANALYSIS_SOURCE,
    requestId,
  );
  return record
    ? { record, outcome: record.result as FormulaAnalysisOutcome }
    : null;
}

async function findReusableAnalysis(cultivatorId: string, signature: string) {
  const records = await getExecutor()
    .select({ result: playerMutationRequests.result })
    .from(playerMutationRequests)
    .where(
      and(
        eq(playerMutationRequests.cultivatorId, cultivatorId),
        eq(playerMutationRequests.source, ANALYSIS_SOURCE),
        sql`${playerMutationRequests.result}->>'status' = 'ready'`,
        sql`${playerMutationRequests.result}->'payload'->>'contextSignature' = ${signature}`,
        sql`(${playerMutationRequests.result}->'payload'->>'expiresAt')::bigint > ${Date.now()}`,
      ),
    )
    .orderBy(desc(playerMutationRequests.createdAt))
    .limit(20);
  for (const record of records) {
    const outcome = record.result as FormulaAnalysisOutcome;
    if (
      outcome.status === 'ready' &&
      !(await analysisConsumed(cultivatorId, outcome.analysisId))
    )
      return outcome;
  }
  return null;
}

async function analysisConsumed(
  cultivatorId: string,
  analysisId: string,
  tx?: DbTransaction,
) {
  return Boolean(
    await findPlayerMutationRequest(
      cultivatorId,
      ANALYSIS_CONSUMED_SOURCE,
      analysisId,
      tx,
    ),
  );
}

function analysisCacheKey(cultivatorId: string, signature: string) {
  return `alchemy:formula_analysis:reuse:v${FORMULA_ANALYSIS_CACHE_VERSION}:${cultivatorId}:${signature}`;
}

async function cacheAnalysis(
  cultivatorId: string,
  outcome: Extract<FormulaAnalysisOutcome, { status: 'ready' }>,
) {
  const ttl = Math.floor(
    ((outcome.payload.expiresAt ?? 0) - Date.now()) / 1000,
  );
  if (ttl <= 0) return;
  try {
    await redis.set(
      getFormulaAnalysisKey(cultivatorId, outcome.analysisId),
      JSON.stringify(outcome.payload),
      'EX',
      ttl,
    );
    await redis.set(
      analysisCacheKey(cultivatorId, outcome.payload.contextSignature!),
      outcome.analysisId,
      'EX',
      ttl,
    );
  } catch (error) {
    // The durable receipt can restore only the original remaining lifetime.
    console.warn('[alchemy] analysis cache write failed', { error });
  }
}

export async function analyzeFormulaMaterials(
  ai: AiService,
  actor: { userId: string; cultivatorId: string },
  formulaId: string,
  input: FormulaAnalysisInput,
  modelKey: string,
): Promise<CommittedCommand<FormulaAnalysisResult>> {
  const cultivatorId = actor.cultivatorId;
  const fingerprint = analysisHash({ formulaId, ...input });
  const idempotency = { key: input.requestId, fingerprint };
  const actionInstanceId = `formula-analysis:${cultivatorId}:${input.requestId}`;

  return withRedisLock(
    {
      key: redisLockKeys.alchemyAnalysis(cultivatorId),
      context: 'alchemy-formula-analysis',
      timeoutMs: 30_000,
    },
    async (lease) => {
      const fail = async (
        message: string,
      ): Promise<CommittedCommand<FormulaAnalysisResult>> => {
        const failed =
          await playerCommandExecutor.executeWithLock<FormulaAnalysisOutcome>({
            ...actor,
            source: ANALYSIS_SOURCE,
            idempotency,
            command: async (tx) => {
              await QiService.refundReservation({
                actionInstanceId,
                reason: 'formula_analysis_failed',
                tx,
              });
              const [current] = await tx
                .select({
                  qi: cultivators.qi,
                  refreshedAt: cultivators.qiLastRefreshedAt,
                })
                .from(cultivators)
                .where(eq(cultivators.id, cultivatorId))
                .limit(1);
              return {
                result: {
                  status: 'failed',
                  message,
                } satisfies FormulaAnalysisOutcome,
                resourceChanges: [
                  qiCurrencyChange('currency.alchemy-analysis.refunded', {
                    qiAfter: current!.qi,
                    qiLastRefreshedAt:
                      current!.refreshedAt?.toISOString() ?? null,
                  }),
                ],
              };
            },
          });
        if (failed.result.status === 'ready') return present(failed.result);
        throw new AlchemyServiceError(failed.result.message, 503, {
          analysisFinal: true,
          qiRefunded: true,
          state: failed.state,
        });
      };

      const present = async (
        outcome: FormulaAnalysisOutcome,
      ): Promise<CommittedCommand<FormulaAnalysisResult>> => {
        const state = await analysisState(cultivatorId);
        if (outcome.status === 'failed')
          throw new AlchemyServiceError(outcome.message, 503, {
            analysisFinal: true,
            qiRefunded: true,
            state,
          });
        if (
          (outcome.payload.expiresAt ?? 0) <= Date.now() ||
          (await analysisConsumed(cultivatorId, outcome.analysisId))
        )
          throw new AlchemyServiceError(
            '本次推演已过期或已用于炼制，请重新推演。',
            409,
            { analysisFinal: true, state },
          );
        const current = await loadAnalysisContext(
          cultivatorId,
          formulaId,
          input,
          modelKey,
        );
        if (current.signature !== outcome.payload.contextSignature)
          throw new AlchemyServiceError(
            '丹方或材料已发生变化，请重新推演。',
            409,
            { analysisFinal: true, state },
          );
        await cacheAnalysis(cultivatorId, outcome);
        const projection = resolveFormulaCraftProjection(
          current.formula,
          current.materials,
          outcome.payload,
        );
        const cooldown = await redis.ttl(
          getFormulaAnalysisCooldownKey(cultivatorId),
        );
        return {
          state,
          result: {
            analysisId: outcome.analysisId,
            valid: true,
            qiCostPaid: outcome.payload.qiCostPaid,
            fitScore: outcome.payload.fitScore,
            fitBand: outcome.payload.fitBand,
            conclusion: outcome.payload.conclusion,
            warnings: outcome.payload.warnings,
            materialJudgments: outcome.payload.materialJudgments,
            batchProfile: toAlchemyBatchDisplayProfile(
              outcome.payload.batchProfile,
              current.materials,
              projection.yieldFactors,
            ),
            dominantElement: outcome.payload.dominantElement,
            stability: projection.stability,
            toxicityRating: projection.toxicityRating,
            cooldownRemainingSeconds: Math.max(0, cooldown),
            expiresInSeconds: Math.max(
              0,
              Math.floor((outcome.payload.expiresAt! - Date.now()) / 1000),
            ),
          },
        };
      };

      const previous = await readAnalysisOutcome(cultivatorId, input.requestId);
      if (previous) {
        if (previous.record.requestFingerprint !== fingerprint)
          throw new AlchemyServiceError(
            '同一推演请求不能更换丹方或材料。',
            409,
          );
        return present(previous.outcome);
      }
      const pending = await findPlayerMutationRequest(
        cultivatorId,
        ANALYSIS_RESERVE_SOURCE,
        input.requestId,
      );
      if (pending) {
        if (pending.requestFingerprint !== fingerprint)
          throw new AlchemyServiceError(
            '同一推演请求不能更换丹方或材料。',
            409,
          );
        return fail('上次推演未完成，灵气已退还，请重新推演。');
      }

      const context = await loadAnalysisContext(
        cultivatorId,
        formulaId,
        input,
        modelKey,
      );
      const cachedId = await redis.get(
        analysisCacheKey(cultivatorId, context.signature),
      );
      const cached = cachedId
        ? await readAnalysisOutcome(cultivatorId, cachedId)
        : null;
      const reusable =
        cached?.outcome.status === 'ready' &&
        cached.outcome.payload.contextSignature === context.signature &&
        (cached.outcome.payload.expiresAt ?? 0) > Date.now() &&
        !(await analysisConsumed(cultivatorId, cached.outcome.analysisId))
          ? cached.outcome
          : await findReusableAnalysis(cultivatorId, context.signature);
      if (reusable) {
        const reused = await playerCommandExecutor.executeWithLock({
          ...actor,
          source: ANALYSIS_SOURCE,
          idempotency,
          allowEmpty: true,
          command: async () => ({
            result: reusable,
            resourceChanges: [],
          }),
        });
        return present(reused.result);
      }

      const cooldown =
        await checkAndAcquireFormulaAnalysisCooldown(cultivatorId);
      if (!cooldown.allowed)
        throw new AlchemyServiceError(
          `请 ${cooldown.remainingSeconds} 秒后再推演药路。`,
          429,
          { remainingSeconds: cooldown.remainingSeconds },
        );
      const reservation = await playerCommandExecutor.executeWithLock({
        ...actor,
        source: ANALYSIS_RESERVE_SOURCE,
        idempotency,
        command: async (tx) => {
          const current = await loadAnalysisContext(
            cultivatorId,
            formulaId,
            input,
            modelKey,
            tx,
          );
          if (current.signature !== context.signature)
            throw new AlchemyServiceError(
              '丹方或材料已发生变化，请重新推演。',
              409,
            );
          const reserved = await QiService.reserveQi({
            cultivatorId,
            action: 'alchemy_formula',
            actionInstanceId,
            cost: calculateAlchemyAnalysisQiCost(
              calculateAlchemyQiCost(current.materials),
            ),
            metadata: {
              formulaId,
              analysisId: input.requestId,
              phase: 'formula_analysis',
            },
            tx,
          });
          return {
            result: { qiCostPaid: reserved.consumed },
            resourceChanges: [
              qiCurrencyChange('currency.alchemy-analysis.reserved', reserved),
            ],
          };
        },
      });
      if (reservation.state.replayed)
        return fail('上次推演未完成，灵气已退还，请重新推演。');

      let ready: Extract<FormulaAnalysisOutcome, { status: 'ready' }>;
      try {
        const analysis = await new AlchemyFormulaAnalyzer(ai).analyze({
          formula: context.formula,
          materials: context.materials,
        });
        lease.assertHeld();
        const completed = await playerCommandExecutor.executeWithLock({
          ...actor,
          source: ANALYSIS_SOURCE,
          idempotency,
          allowEmpty: true,
          command: async (tx) => {
            const current = await loadAnalysisContext(
              cultivatorId,
              formulaId,
              input,
              modelKey,
              tx,
            );
            if (current.signature !== context.signature)
              throw new AlchemyServiceError(
                '推演期间丹方或材料发生变化。',
                409,
              );
            const payload: FormulaAnalysisPayload = {
              ...buildFormulaAnalysisPayload(
                cultivatorId,
                current.formula,
                current.materials,
                analysis.plan,
                analysis.fitBand,
                analysis.conclusion,
                analysis.materialJudgments,
              ),
              qiCostPaid: reservation.result.qiCostPaid,
              contextSignature: context.signature,
              modelKey,
              expiresAt: Date.now() + FORMULA_ANALYSIS_TTL_SECONDS * 1000,
            };
            await QiService.commitReservation({
              actionInstanceId,
              metadata: { analysisId: input.requestId },
              tx,
            });
            return {
              result: {
                status: 'ready',
                analysisId: input.requestId,
                payload,
              } satisfies FormulaAnalysisOutcome,
              resourceChanges: [],
            };
          },
        });
        if (completed.result.status !== 'ready')
          throw new Error('推演终态不一致');
        ready = completed.result;
      } catch (error) {
        // Do not log model text or prompts; diagnose failures without a correction call.
        console.warn('[alchemy] formula analysis failed', {
          errorName: error instanceof Error ? error.name : 'unknown',
        });
        return fail('药路推演未明，灵气已退还，请重新推演。');
      }
      return present(ready);
    },
  );
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
  const rows = await loadAlchemyMaterials(cultivatorId, materialIds);

  let materialsList: PreparedAlchemyMaterial[];
  try {
    materialsList = buildPreparedMaterials(rows, materialQuantities);
  } catch (error) {
    if (error instanceof AlchemyServiceError) {
      return {
        cost: { spiritStones: 0, qi: 1 },
        canAfford: true,
        validation: createValidation(false, error.message),
      };
    }
    throw error;
  }

  const highestMaterialRank = calculateHighestMaterialRank(
    rows as Array<{ rank: Quality }>,
  );
  const baseSpiritStones = scaleFateAdjustedCost(
    calculateAlchemyCost(highestMaterialRank),
    getAlchemySpiritStoneMultiplier(evaluateFateContext(fates)),
  );
  const spiritStones = await sectOrganizationFacade.applyCraftDiscount(
    cultivatorId,
    baseSpiritStones,
    'sect.craft.alchemy',
  );

  return {
    cost: {
      spiritStones,
      qi: calculateAlchemyQiCost(materialsList),
    },
    canAfford: availableSpiritStones >= spiritStones,
    validation: validateFormulaIngredients(formula, materialsList),
  };
}

export interface PreparedFormulaCraft {
  qiCost: number;
  commit(tx: DbTransaction): Promise<{
    result: {
      consumable: Consumable;
      craftedConsumables: Consumable[];
      consumables: Consumable[];
      yieldProfile: import('@daoyou/game-domain/consumables').AlchemyYieldDisplayProfile;
      formulaProgress: FormulaProgress;
    };
    inventoryChanges: ResourceOperationSettlement['inventoryChanges'];
    afterCommit: () => Promise<void>;
  }>;
}

export async function prepareFormulaCraft(
  cultivatorId: string,
  formulaId: string,
  materialIds: string[],
  materialQuantities?: Record<string, number>,
  analysisId?: string,
  materialVersions?: Record<string, string>,
  craftRequestId?: string,
): Promise<PreparedFormulaCraft> {
  // 分布式锁由 API/Application 层统一获取。
  const q = getExecutor();
  const [formula, selectedMaterials, cultivator, preHeavenFates, rawAnalysis] =
    await Promise.all([
      loadCultivatorFormula(cultivatorId, formulaId, q),
      loadOwnedMaterials(cultivatorId, materialIds, q),
      q
        .select({
          userId: cultivators.userId,
          spirit_stones: cultivators.spirit_stones,
          realm: cultivators.realm,
        })
        .from(cultivators)
        .where(eq(cultivators.id, cultivatorId))
        .limit(1)
        .then((rows) => rows[0]),
      getCultivatorPreHeavenFates(cultivatorId, q),
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
  const receipt = await readAnalysisOutcome(cultivatorId, analysisId);
  const prepaid =
    receipt?.outcome.status === 'ready' &&
    receipt.outcome.analysisId === analysisId
      ? receipt.outcome
      : null;
  const analysisPayload =
    prepaid?.payload ??
    parseRedisJson<FormulaAnalysisPayload>(rawAnalysis, analysisKey);
  if (!analysisPayload) {
    throw new AlchemyServiceError('请先推演药路。');
  }
  if (analysisPayload.qiCostPaid !== undefined && !prepaid)
    throw new AlchemyServiceError('推演凭据已失效，请先推演药路。', 409);
  if (prepaid) {
    if (
      (prepaid.payload.expiresAt ?? 0) <= Date.now() ||
      (await analysisConsumed(cultivatorId, analysisId))
    )
      throw new AlchemyServiceError(
        '推演已过期或已用于炼制，请先推演药路。',
        409,
      );
    const current = await loadAnalysisContext(
      cultivatorId,
      formulaId,
      {
        requestId: analysisId,
        materialIds,
        materialVersions: materialVersions ?? {},
        materialQuantities,
      },
      prepaid.payload.modelKey!,
    );
    if (current.signature !== prepaid.payload.contextSignature)
      throw new AlchemyServiceError(
        '丹方或材料已发生变化，请先推演药路。',
        409,
      );
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
  const baseCost = scaleFateAdjustedCost(
    calculateAlchemyCost(highestMaterialRank),
    getAlchemySpiritStoneMultiplier(evaluateFateContext(preHeavenFates)),
  );
  const cost = await sectOrganizationFacade.applyCraftDiscount(
    cultivatorId,
    baseCost,
    'sect.craft.alchemy',
    q,
  );
  if ((cultivator.spirit_stones ?? 0) < cost) {
    throw new AlchemyServiceError(`灵石不足，需要 ${cost} 枚`);
  }

  const aggregated = aggregateAlchemyProperties(
    materialsList,
    analysisPayload.plan,
  );
  const fitBand = analysisPayload.fitBand;
  const fitScore = getFormulaFitPolicy(fitBand).score;
  const batchProfile = buildAlchemyBatchProfile(materialsList, aggregated, {
    formulaFitBand: fitBand,
    materialJudgments: analysisPayload.materialJudgments,
  });

  const dominantElement = aggregated.dominantElement;
  const projection = resolveFormulaCraftProjection(formula, materialsList, {
    fitBand,
    batchProfile,
    dominantElement,
  });
  const qiCost = calculateAlchemyCraftQiCost(
    calculateAlchemyQiCost(materialsList),
    prepaid?.payload.qiCostPaid,
  );
  if (formula.blueprint.needsRebirth) {
    throw new AlchemyServiceError('此丹方需要升级后才能炼制。', 409);
  }
  const spec: Omit<PillSpec, 'operations'> = {
    kind: 'pill',
    family: formula.family,
    consumeRules: {
      ...formula.blueprint.consumeRules,
      quotaCategory: getQuotaCategoryForFamily(formula.family),
    },
    alchemyMeta: {
      source: 'formula',
      formulaId: formula.id,
      version: 4,
      sourceMaterials: materialsList.map((material) => material.name),
      analysisVersion: 2,
      propertyVector: formula.blueprint.route.effects,
      sourceMaterialVectors: aggregated.sourceMaterialVectors,
      fitScore,
      fitBand,
      fitMultiplier: projection.fitMultiplier,
      dominantElement: formula.pattern.dominantElement ?? dominantElement,
      stability: projection.stability,
      toxicityRating: projection.toxicityRating,
      // 批次生成前的中性占位；最终品相由产出引擎逐枚生成并覆盖。
      appearance: 'middle',
      tags: buildAlchemyPropertyTags(
        formula.blueprint.route.effects,
        formula.family,
      ),
      batch: (() => {
        const persisted = { ...batchProfile };
        delete persisted.essenceSummary;
        delete persisted.yieldProfile;
        return persisted;
      })(),
    },
  };
  const breakthroughTargetRealm =
    formula.family === 'breakthrough'
      ? getNextMajorRealm(cultivator.realm as RealmType)
      : null;
  const usesFixedBreakthroughName =
    formula.family === 'breakthrough' &&
    breakthroughTargetRealm !== null &&
    formula.blueprint.route.effects.some(
      (effect) => effect.key === 'breakthrough_support',
    );
  if (usesFixedBreakthroughName) {
    spec.alchemyMeta.breakthroughTargetRealm = breakthroughTargetRealm;
    spec.alchemyMeta.breakthroughLabel = getBreakthroughPillLabel(
      breakthroughTargetRealm,
    );
  } else if (formula.family === 'breakthrough' && breakthroughTargetRealm) {
    spec.alchemyMeta.breakthroughTargetRealm = breakthroughTargetRealm;
  }
  const draft: AlchemyOutputDraft = {
    name: usesFixedBreakthroughName
      ? getBreakthroughPillLabel(breakthroughTargetRealm)
      : getFormulaProductName(formula.name),
    type: '丹药',
    description: buildFormulaDescription(
      formula,
      materialsList.map((material) => material.name),
      spec.alchemyMeta.stability,
      spec.alchemyMeta.toxicityRating,
      projection.fitMultiplier,
      fitBand,
    ),
    spec,
    route: formula.blueprint.route,
    fitMultiplier: projection.fitMultiplier,
  };
  const { next: nextMastery, progress } = advanceFormulaMastery(
    formula.mastery,
    fitBand,
  );

  const afterCommit = async () => {
    await redis.del(analysisKey);
  };

  return {
    qiCost,
    async commit(tx: DbTransaction) {
      if (prepaid) {
        if (
          (prepaid.payload.expiresAt ?? 0) <= Date.now() ||
          (await analysisConsumed(cultivatorId, analysisId!, tx))
        )
          throw new AlchemyServiceError(
            '推演已过期或已用于炼制，请先推演药路。',
            409,
          );
        // Same transaction as inventory/payment/mastery: Redis deletion is only cleanup.
        await insertPlayerMutationRequest(
          {
            cultivatorId,
            source: ANALYSIS_CONSUMED_SOURCE,
            requestId: analysisId!,
            requestFingerprint: analysisHash(prepaid.payload),
            result: { craftRequestId },
          },
          tx,
        );
      }
      const inventoryChanges: ResourceOperationSettlement['inventoryChanges'] =
        [];
      const stableMaterialIds = [...materialIds].sort();
      const currentRows = await loadOwnedMaterials(
        cultivatorId,
        stableMaterialIds,
        tx,
      );
      const currentById = new Map(currentRows.map((row) => [row.id, row]));
      const expectedById = new Map(
        selectedMaterials.map((row) => [row.id, row]),
      );
      for (const id of stableMaterialIds) {
        const current = currentById.get(id);
        const expected = expectedById.get(id);
        if (
          !current ||
          !expected ||
          JSON.stringify(current.members) !==
            JSON.stringify(expected.members) ||
          current.description !== expected.description ||
          current.quantity !== expected.quantity ||
          current.rank !== expected.rank ||
          current.type !== expected.type ||
          current.element !== expected.element
        ) {
          throw new AlchemyServiceError(
            '材料已发生变化，请重新推演药路。',
            409,
          );
        }
      }

      // Roll only after the analysis/material snapshot has been revalidated and
      // the user has actually confirmed the craft.
      const yieldProfile = rollAlchemyYieldProfile({
        materials: materialsList,
        factors: projection.yieldFactors,
      });
      const outputConsumables = assembleAlchemyOutputConsumables(
        draft,
        yieldProfile,
      );
      if (outputConsumables.length === 0) {
        throw new AlchemyServiceError('本炉药蕴不足，无法凝成丹药。', 400);
      }

      const [charged] = await tx
        .update(cultivators)
        .set({
          spirit_stones: sql`${cultivators.spirit_stones} - ${cost}`,
        })
        .where(
          and(
            eq(cultivators.id, cultivatorId),
            eq(cultivators.userId, cultivator.userId),
            sql`${cultivators.spirit_stones} >= ${cost}`,
          ),
        )
        .returning({ id: cultivators.id });
      if (!charged) {
        throw new AlchemyServiceError(`灵石不足，需要 ${cost} 枚`, 409);
      }

      await consumeAlchemyMaterials(
        cultivatorId,
        selectedMaterials,
        materialsList,
        tx,
      );

      const savedConsumables = await grantAlchemyOutput(
        cultivatorId,
        outputConsumables,
        tx,
      );

      const [masteryUpdated] = await tx
        .update(alchemyFormulas)
        .set({ mastery: nextMastery })
        .where(
          and(
            eq(alchemyFormulas.id, formula.id),
            eq(alchemyFormulas.cultivatorId, cultivatorId),
            sql`${alchemyFormulas.mastery} = ${JSON.stringify(
              formula.mastery,
            )}::jsonb`,
          ),
        )
        .returning({ id: alchemyFormulas.id });
      if (!masteryUpdated) {
        throw new AlchemyServiceError('丹方熟练度已发生变化，请重试。', 409);
      }

      return {
        result: {
          consumable: savedConsumables[0]!,
          consumables: savedConsumables,
          craftedConsumables: savedConsumables,
          yieldProfile: toAlchemyYieldDisplayProfile(yieldProfile),
          formulaProgress: progress,
        },
        inventoryChanges,
        afterCommit,
      };
    },
  };
}
