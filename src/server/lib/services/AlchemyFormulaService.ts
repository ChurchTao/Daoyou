import { calculateCraftCost, calculateHighestMaterialRank } from '@shared/engine/creation-v2/CraftCostCalculator';
import {
  getMaterialAlchemyTagFamily,
  getMaterialAlchemyTagLabel,
  getTrackPathAlchemyTag,
  isAlchemyMaterialType,
  readMaterialAlchemyProfile,
} from '@shared/lib/materialAlchemy';
import type { ConditionTrackPath } from '@shared/types/condition';
import { QUALITY_ORDER, type ElementType, type MaterialType, type Quality } from '@shared/types/constants';
import type { MaterialDetails, Consumable } from '@shared/types/cultivator';
import type {
  AlchemyFormula,
  AlchemyFormulaDiscoveryCandidate,
  AlchemyFormulaMastery,
  AlchemyFormulaPattern,
  ConditionOperation,
  MaterialAlchemyEffectTag,
  PillSpec,
} from '@shared/types/consumable';
import { getExecutor } from '@server/lib/drizzle/db';
import {
  alchemyFormulas,
  consumables,
  cultivators,
  materials,
} from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import { calculateSingleElixirScore } from '@server/utils/rankingUtils';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { AlchemyServiceError } from './AlchemyServiceError';
import { mapConsumableRow, serializeConsumableSpec } from './consumablePersistence';
import { addConsumableToInventory } from './cultivatorService';

const DISCOVERY_TTL_SECONDS = 600;
const FORMULA_LOCK_TTL_SECONDS = 30;
const DISCOVERY_STABILITY_THRESHOLD = 70;
const HYBRID_DISCOVERY_TAGS: MaterialAlchemyEffectTag[] = [
  'healing',
  'mana',
  'detox',
];

type MaterialRow = typeof materials.$inferSelect;
type AlchemyFormulaRow = typeof alchemyFormulas.$inferSelect;

export interface PreparedFormulaIngredient {
  id: string;
  name: string;
  rank: Quality;
  element: ElementType;
  type: Extract<MaterialType, 'herb' | 'ore' | 'monster' | 'tcdb' | 'aux'>;
  dose: number;
  effectTags: MaterialAlchemyEffectTag[];
  potency: number;
}

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

interface DiscoveryContext {
  consumable: Consumable & { spec: PillSpec };
  ingredients: PreparedFormulaIngredient[];
  targetTags: MaterialAlchemyEffectTag[];
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

function getDiscoveryKey(cultivatorId: string, token: string): string {
  return `alchemy:formula_discovery:${cultivatorId}:${token}`;
}

function getFormulaLockKey(cultivatorId: string): string {
  return `alchemy:lock:${cultivatorId}`;
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

function mapAlchemyFormulaRow(row: AlchemyFormulaRow): AlchemyFormula {
  return {
    id: row.id,
    cultivatorId: row.cultivatorId,
    name: row.name,
    family: row.family,
    pattern: row.pattern,
    blueprint: row.blueprint,
    mastery: row.mastery,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function getPatternSummary(pattern: AlchemyFormulaPattern): string {
  const segments = [
    `主药性：${pattern.requiredTags.map(getMaterialAlchemyTagLabel).join('、')}`,
    `炉位：${pattern.slotCount} 种材料`,
  ];

  if (pattern.optionalTags?.length) {
    segments.push(`辅药性：${pattern.optionalTags.map(getMaterialAlchemyTagLabel).join('、')}`);
  }
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

function buildFormulaDescription(
  formula: AlchemyFormula,
  sourceMaterials: string[],
  stability: number,
  toxicityRating: number,
  fitMultiplier: number,
): string {
  return [
    `依《${formula.name}》炉意炼成，以${sourceMaterials.join('、')}合炉。`,
    `成丹稳度 ${stability}，丹毒评定 ${toxicityRating}，药力拟合 ${(fitMultiplier * 100).toFixed(0)}%。`,
  ].join('');
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

function getRequiredTagsForFamily(
  spec: PillSpec,
  tagScores: Map<MaterialAlchemyEffectTag, number>,
): MaterialAlchemyEffectTag[] {
  switch (spec.family) {
    case 'healing':
    case 'mana':
    case 'detox':
    case 'breakthrough':
    case 'marrow_wash':
      return [spec.family];
    case 'tempering': {
      const track = spec.operations.find(
        (operation): operation is Extract<ConditionOperation, { type: 'advance_track' }> =>
          operation.type === 'advance_track' &&
          operation.track.startsWith('tempering.'),
      );
      const trackPath = (track?.track ?? 'tempering.vitality') as Extract<
        ConditionTrackPath,
        `tempering.${string}`
      >;

      return [
        getTrackPathAlchemyTag(trackPath),
      ];
    }
    case 'hybrid': {
      const ranked = HYBRID_DISCOVERY_TAGS
        .map((tag) => [tag, tagScores.get(tag) ?? 0] as const)
        .sort((left, right) => right[1] - left[1]);

      return ranked
        .filter(([, score]) => score > 0)
        .slice(0, 2)
        .map(([tag]) => tag);
    }
  }
}

function buildTagScores(
  ingredients: PreparedFormulaIngredient[],
  targetTags: MaterialAlchemyEffectTag[],
): Map<MaterialAlchemyEffectTag, number> {
  const tagScores = new Map<MaterialAlchemyEffectTag, number>();
  const targetFamilies = new Set(
    targetTags.map((tag) => getMaterialAlchemyTagFamily(tag)),
  );

  for (const ingredient of ingredients) {
    const contribution = ingredient.dose * ingredient.potency;
    for (const tag of ingredient.effectTags) {
      const family = getMaterialAlchemyTagFamily(tag);
      const multiplier = targetTags.includes(tag)
        ? 1.5
        : targetFamilies.has(family)
          ? 1.15
          : 1;
      tagScores.set(tag, (tagScores.get(tag) ?? 0) + contribution * multiplier);
    }
  }

  return tagScores;
}

function buildOptionalTags(
  requiredTags: MaterialAlchemyEffectTag[],
  tagScores: Map<MaterialAlchemyEffectTag, number>,
): MaterialAlchemyEffectTag[] | undefined {
  const strongestRequiredScore = requiredTags.reduce(
    (highest, tag) => Math.max(highest, tagScores.get(tag) ?? 0),
    0,
  );
  const threshold = strongestRequiredScore * 0.5;
  const requiredTagSet = new Set(requiredTags);

  const optionalTags = [...tagScores.entries()]
    .sort((left, right) => right[1] - left[1])
    .filter(([tag, score]) => !requiredTagSet.has(tag) && score >= threshold)
    .map(([tag]) => tag);

  return optionalTags.length > 0 ? optionalTags : undefined;
}

function getLowestQuality(ingredients: PreparedFormulaIngredient[]): Quality {
  return ingredients.reduce((lowest, ingredient) => {
    if (!lowest) {
      return ingredient.rank;
    }
    return QUALITY_ORDER[ingredient.rank] < QUALITY_ORDER[lowest]
      ? ingredient.rank
      : lowest;
  }, ingredients[0]!.rank);
}

function chooseDominantElement(
  ingredients: PreparedFormulaIngredient[],
): ElementType {
  const elementScores = new Map<ElementType, number>();

  for (const ingredient of ingredients) {
    elementScores.set(
      ingredient.element,
      (elementScores.get(ingredient.element) ?? 0) +
        ingredient.dose * ingredient.potency,
    );
  }

  const [dominant] = [...elementScores.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0], 'zh-Hans-CN');
  });

  return dominant?.[0] ?? '土';
}

function validateMaterialRows(
  materialRows: MaterialRow[],
): { valid: boolean; blockingReason?: string } {
  for (const material of materialRows) {
    if (!material.element) {
      return {
        valid: false,
        blockingReason: `材料 ${material.name} 缺少五行属性，当前无法入炉。`,
      };
    }
    if (!isAlchemyMaterialType(material.type as MaterialType)) {
      return {
        valid: false,
        blockingReason: `材料 ${material.name} 不可用于炼丹。`,
      };
    }
    if (
      !readMaterialAlchemyProfile(
        (material.details ?? undefined) as MaterialDetails | undefined,
      )
    ) {
      return {
        valid: false,
        blockingReason: `材料 ${material.name} 缺少药性画像，请清空旧库存后重试。`,
      };
    }
  }

  return { valid: true };
}

function buildPreparedIngredients(
  materialRows: MaterialRow[],
  materialQuantities?: Record<string, number>,
): PreparedFormulaIngredient[] {
  return materialRows.map((material) => {
    const profile = readMaterialAlchemyProfile(
      (material.details ?? undefined) as MaterialDetails | undefined,
    );
    if (!material.id) {
      throw new AlchemyServiceError('材料记录缺少主键', 500);
    }
    if (!material.element) {
      throw new AlchemyServiceError(`材料 ${material.name} 缺少五行属性`, 400);
    }
    if (!isAlchemyMaterialType(material.type as MaterialType)) {
      throw new AlchemyServiceError(`材料 ${material.name} 不可用于炼丹`, 400);
    }
    if (!profile) {
      throw new AlchemyServiceError(
        `材料 ${material.name} 缺少药性画像，请清空旧库存后重试。`,
        400,
      );
    }

    return {
      id: material.id,
      name: material.name,
      rank: material.rank as Quality,
      element: material.element as ElementType,
      type: material.type as PreparedFormulaIngredient['type'],
      dose: normalizeDose(material, materialQuantities),
      effectTags: profile.effectTags,
      potency: profile.potency,
    };
  });
}

function getCoverageTags(
  ingredients: PreparedFormulaIngredient[],
): Set<MaterialAlchemyEffectTag> {
  return new Set(ingredients.flatMap((ingredient) => ingredient.effectTags));
}

function buildFormulaWarnings(
  formula: AlchemyFormula,
  ingredients: PreparedFormulaIngredient[],
): string[] {
  const warnings: string[] = [];
  const currentDominantElement = chooseDominantElement(ingredients);
  const matchedOptionalTags = (formula.pattern.optionalTags ?? []).filter((tag) =>
    ingredients.some((ingredient) => ingredient.effectTags.includes(tag)),
  );

  if (
    formula.pattern.dominantElement &&
    currentDominantElement !== formula.pattern.dominantElement
  ) {
    warnings.push('本炉主元素偏离丹方原意，成丹拟合会略有折损。');
  }

  if (
    (formula.pattern.optionalTags?.length ?? 0) > 0 &&
    matchedOptionalTags.length < (formula.pattern.optionalTags?.length ?? 0)
  ) {
    warnings.push('辅性药材未尽契合丹方，药力尚有缺口。');
  }

  return warnings;
}

function validateFormulaIngredients(
  formula: AlchemyFormula,
  ingredients: PreparedFormulaIngredient[],
) {
  if (ingredients.length !== formula.pattern.slotCount) {
    return createValidation(
      false,
      `此丹方需投入 ${formula.pattern.slotCount} 种材料。`,
    );
  }

  if (
    formula.pattern.minQuality &&
    ingredients.some(
      (ingredient) =>
        QUALITY_ORDER[ingredient.rank] < QUALITY_ORDER[formula.pattern.minQuality!],
    )
  ) {
    return createValidation(
      false,
      `所选材料中存在低于 ${formula.pattern.minQuality} 的品阶，无法承载此丹方。`,
    );
  }

  const coverageTags = getCoverageTags(ingredients);
  const missingRequiredTags = formula.pattern.requiredTags.filter(
    (tag) => !coverageTags.has(tag),
  );
  if (missingRequiredTags.length > 0) {
    return createValidation(
      false,
      `材料未覆盖丹方核心药性：${missingRequiredTags.map(getMaterialAlchemyTagLabel).join('、')}。`,
    );
  }

  return createValidation(
    true,
    undefined,
    buildFormulaWarnings(formula, ingredients),
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
    requiredTags: [...formula.pattern.requiredTags].sort(),
    slotCount: formula.pattern.slotCount,
  });
}

export function calculateFormulaFitMultiplier(
  formula: AlchemyFormula,
  ingredients: PreparedFormulaIngredient[],
): number {
  let fitMultiplier = 1;
  const dominantElement = chooseDominantElement(ingredients);

  if (
    formula.pattern.dominantElement &&
    dominantElement === formula.pattern.dominantElement
  ) {
    fitMultiplier += 0.05;
  }

  const optionalMatches = (formula.pattern.optionalTags ?? []).filter((tag) =>
    ingredients.some((ingredient) => ingredient.effectTags.includes(tag)),
  );
  fitMultiplier += optionalMatches.length * 0.03;

  if (formula.pattern.minQuality) {
    fitMultiplier += ingredients.filter(
      (ingredient) =>
        QUALITY_ORDER[ingredient.rank] > QUALITY_ORDER[formula.pattern.minQuality!],
    ).length * 0.02;
  }

  return clamp(fitMultiplier, 0.85, 1.15);
}

function scaleFormulaOperations(
  operations: ConditionOperation[],
  fitMultiplier: number,
): ConditionOperation[] {
  return operations.map((operation) => {
    if (
      operation.type === 'restore_resource' ||
      operation.type === 'advance_track'
    ) {
      return {
        ...operation,
        value: Math.max(1, Math.floor(operation.value * fitMultiplier)),
      };
    }

    return operation;
  });
}

export function advanceFormulaMastery(
  mastery: AlchemyFormulaMastery,
): { next: AlchemyFormulaMastery; progress: FormulaProgress } {
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

export async function buildDiscoveryCandidate(
  cultivatorId: string,
  context: DiscoveryContext,
): Promise<AlchemyFormulaDiscoveryCandidate | null> {
  const { consumable, ingredients, targetTags } = context;
  const spec = consumable.spec;

  if (
    spec.alchemyMeta.stability < DISCOVERY_STABILITY_THRESHOLD ||
    spec.operations.length === 0
  ) {
    return null;
  }

  const tagScores = buildTagScores(ingredients, targetTags);
  const requiredTags = getRequiredTagsForFamily(spec, tagScores);
  if (requiredTags.length === 0) {
    return null;
  }

  const formula: Omit<AlchemyFormula, 'id' | 'createdAt' | 'updatedAt'> = {
    cultivatorId,
    name: `${consumable.name}丹方`,
    family: spec.family,
    pattern: {
      requiredTags,
      optionalTags: buildOptionalTags(requiredTags, tagScores),
      dominantElement: spec.alchemyMeta.dominantElement,
      minQuality: getLowestQuality(ingredients),
      slotCount: ingredients.length,
    },
    blueprint: {
      operations: spec.operations,
      consumeRules: spec.consumeRules,
      targetStability: spec.alchemyMeta.stability,
      targetToxicity: spec.alchemyMeta.toxicityRating,
    },
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
    family: formula.family,
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
      .find(
        (formula) => buildFormulaSignature(formula) === payload.signature,
      );

    if (existing) {
      savedFormula = existing;
      return;
    }

    const [inserted] = await tx
      .insert(alchemyFormulas)
      .values({
        cultivatorId,
        name: payload.formula.name,
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

export async function previewFormulaCraft(
  cultivatorId: string,
  formulaId: string,
  materialIds: string[],
  availableSpiritStones: number,
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

  const materialValidation = validateMaterialRows(rows);
  if (!materialValidation.valid) {
    return {
      cost: { spiritStones: 0 },
      canAfford: true,
      validation: createValidation(false, materialValidation.blockingReason),
    };
  }

  const ingredients = buildPreparedIngredients(rows);
  const highestMaterialRank = calculateHighestMaterialRank(
    rows as Array<{ rank: Quality }>,
  );
  const spiritStones = calculateCraftCost(highestMaterialRank, 'spiritStone');

  return {
    cost: { spiritStones },
    canAfford: availableSpiritStones >= spiritStones,
    validation: validateFormulaIngredients(formula, ingredients),
  };
}

export async function craftFromFormula(
  cultivatorId: string,
  formulaId: string,
  materialIds: string[],
  materialQuantities?: Record<string, number>,
): Promise<{ consumable: Consumable; formulaProgress: FormulaProgress }> {
  const lockKey = getFormulaLockKey(cultivatorId);
  const acquired = await redis.set(lockKey, 'locked', 'EX', FORMULA_LOCK_TTL_SECONDS, 'NX');
  if (!acquired) {
    throw new AlchemyServiceError('丹炉已开，道友稍候片刻', 429);
  }

  try {
    const [formula, selectedMaterials, cultivator] = await Promise.all([
      loadCultivatorFormula(cultivatorId, formulaId),
      loadOwnedMaterials(cultivatorId, materialIds),
      getExecutor()
        .select()
        .from(cultivators)
        .where(eq(cultivators.id, cultivatorId))
        .limit(1)
        .then((rows) => rows[0]),
    ]);

    if (!cultivator) {
      throw new AlchemyServiceError('道友查无此人', 404);
    }

    const ingredients = buildPreparedIngredients(
      selectedMaterials,
      materialQuantities,
    );
    const validation = validateFormulaIngredients(formula, ingredients);
    if (!validation.valid) {
      throw new AlchemyServiceError(validation.blockingReason || '丹方不合。');
    }

    const highestMaterialRank = calculateHighestMaterialRank(
      selectedMaterials as Array<{ rank: Quality }>,
    );
    const cost = calculateCraftCost(highestMaterialRank, 'spiritStone');
    if ((cultivator.spirit_stones ?? 0) < cost) {
      throw new AlchemyServiceError(`灵石不足，需要 ${cost} 枚`);
    }

    const fitMultiplier = calculateFormulaFitMultiplier(formula, ingredients);
    const dominantElement = chooseDominantElement(ingredients);
    const masteryBonusStability = formula.mastery.level * 2;
    const masteryBonusToxicity = formula.mastery.level;
    const spec: PillSpec = {
      kind: 'pill',
      family: formula.family,
      operations: scaleFormulaOperations(
        formula.blueprint.operations,
        fitMultiplier,
      ),
      consumeRules: formula.blueprint.consumeRules,
      alchemyMeta: {
        source: 'formula',
        formulaId: formula.id,
        sourceMaterials: ingredients.map((ingredient) => ingredient.name),
        dominantElement,
        stability: clamp(
          formula.blueprint.targetStability + masteryBonusStability,
          15,
          95,
        ),
        toxicityRating: clamp(
          formula.blueprint.targetToxicity - masteryBonusToxicity,
          0,
          100,
        ),
        tags: Array.from(
          new Set([
            ...formula.pattern.requiredTags,
            ...(formula.pattern.optionalTags ?? []),
            formula.family,
          ]),
        ),
      },
    };
    const consumable: Consumable = {
      name: getFormulaProductName(formula.name),
      type: '丹药',
      quality: highestMaterialRank,
      quantity: 1,
      description: buildFormulaDescription(
        formula,
        ingredients.map((ingredient) => ingredient.name),
        spec.alchemyMeta.stability,
        spec.alchemyMeta.toxicityRating,
        fitMultiplier,
      ),
      score: 0,
      spec,
    };
    consumable.score = calculateSingleElixirScore(consumable);

    const { next: nextMastery, progress } = advanceFormulaMastery(
      formula.mastery,
    );

    await getExecutor().transaction(async (tx) => {
      for (const ingredient of ingredients) {
        const material = selectedMaterials.find((item) => item.id === ingredient.id);
        if (!material) {
          throw new AlchemyServiceError('材料记录异常，无法扣除', 500);
        }

        if (ingredient.dose >= material.quantity) {
          await tx.delete(materials).where(eq(materials.id, material.id));
        } else {
          await tx
            .update(materials)
            .set({ quantity: material.quantity - ingredient.dose })
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
    });

    const inserted = await getExecutor()
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
    };
  } finally {
    await redis.del(lockKey);
  }
}
