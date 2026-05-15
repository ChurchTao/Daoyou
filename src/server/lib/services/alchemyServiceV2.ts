import { calculateCraftCost, calculateHighestMaterialRank } from '@shared/engine/creation-v2/CraftCostCalculator';
import {
  ELEMENT_PREFIX_MAP,
  type AlchemyMaterialType,
} from '@shared/config/alchemyProfile';
import {
  getMaterialAlchemyTagFamily,
  getMaterialAlchemyTrackPath,
  isAlchemyMaterialType,
  readMaterialAlchemyProfile,
} from '@shared/lib/materialAlchemy';
import type { ConditionTrackPath } from '@shared/types/condition';
import type { ElementType, MaterialType, Quality } from '@shared/types/constants';
import type { Consumable, MaterialDetails } from '@shared/types/cultivator';
import type {
  AlchemyFormulaDiscoveryCandidate,
  ConditionOperation,
  MaterialAlchemyEffectTag,
  MaterialAlchemyProfile,
  PillFamily,
  PillSpec,
} from '@shared/types/consumable';
import { getExecutor } from '@server/lib/drizzle/db';
import { consumables, cultivators, materials } from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import { calculateSingleElixirScore } from '@server/utils/rankingUtils';
import { and, eq, inArray } from 'drizzle-orm';
import { buildDiscoveryCandidate } from './AlchemyFormulaService';
import { AlchemyServiceError } from './AlchemyServiceError';
import { addConsumableToInventory } from './cultivatorService';
import { mapConsumableRow, serializeConsumableSpec } from './consumablePersistence';
import {
  AlchemyIntentResolver,
  alchemyIntentResolver,
  type AlchemyFocusMode,
  type AlchemyIntentResolution,
} from './AlchemyIntentResolver';

export { AlchemyServiceError } from './AlchemyServiceError';

type MaterialRow = typeof materials.$inferSelect;
type ShortTermFamily = Extract<PillFamily, 'healing' | 'mana' | 'detox'>;
type LongTermFamily = Extract<PillFamily, 'breakthrough' | 'tempering' | 'marrow_wash'>;

export interface AlchemySelectionValidation {
  valid: boolean;
  blockingReason?: string;
  warnings: string[];
}

export interface AlchemyPreviewResult {
  cost: {
    spiritStones: number;
  };
  canAfford: boolean;
  validation: AlchemySelectionValidation;
}

export interface PreparedAlchemyIngredient {
  id: string;
  name: string;
  rank: Quality;
  element: ElementType;
  type: AlchemyMaterialType;
  dose: number;
  profile: MaterialAlchemyProfile;
}

export interface AlchemySynthesisResult {
  family: PillFamily;
  dominantElement: ElementType;
  stability: number;
  toxicityRating: number;
  operations: ConditionOperation[];
  trackPath?: Extract<ConditionTrackPath, `tempering.${string}`>;
}

export interface ImprovisedAlchemyCraftResult {
  consumable: Consumable;
  formulaDiscovery?: AlchemyFormulaDiscoveryCandidate;
}

const SHORT_TERM_FAMILIES = new Set<ShortTermFamily>([
  'healing',
  'mana',
  'detox',
]);
const LONG_TERM_FAMILIES = new Set<LongTermFamily>([
  'breakthrough',
  'tempering',
  'marrow_wash',
]);
const FAMILY_PRIORITY: Record<PillFamily, number> = {
  breakthrough: 0,
  tempering: 1,
  marrow_wash: 2,
  healing: 3,
  mana: 4,
  detox: 5,
  hybrid: 6,
};
const TRACK_PRIORITY: Record<Extract<ConditionTrackPath, `tempering.${string}`>, number> = {
  'tempering.vitality': 0,
  'tempering.spirit': 1,
  'tempering.wisdom': 2,
  'tempering.speed': 3,
  'tempering.willpower': 4,
};

const FAMILY_NAME_MAP: Record<PillFamily, string> = {
  healing: '疗伤丹',
  mana: '回元丹',
  detox: '解毒丹',
  breakthrough: '破境丹',
  tempering: '淬体丹',
  marrow_wash: '洗髓丹',
  hybrid: '和元丹',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getQualityScalar(quality: Quality): number {
  const values: Quality[] = [
    '凡品',
    '灵品',
    '玄品',
    '真品',
    '地品',
    '天品',
    '仙品',
    '神品',
  ];
  return 1 + values.indexOf(quality) * 0.22;
}

function countsTowardsQuota(family: PillFamily): boolean {
  return LONG_TERM_FAMILIES.has(family as LongTermFamily);
}

function sortRowsByRequestedIds(
  rows: MaterialRow[],
  requestedIds: string[],
): MaterialRow[] {
  const rank = new Map(requestedIds.map((id, index) => [id, index]));
  return [...rows].sort((left, right) => {
    const leftRank = rank.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank;
  });
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

function pickHighestRank(materialRows: MaterialRow[]): Quality | null {
  if (materialRows.length === 0) return null;
  return calculateHighestMaterialRank(
    materialRows as Array<{ rank: Quality }>,
  );
}

function createValidation(
  valid: boolean,
  blockingReason?: string,
  warnings: string[] = [],
): AlchemySelectionValidation {
  return {
    valid,
    blockingReason,
    warnings,
  };
}

function describeFocusMode(focusMode: AlchemyFocusMode): string {
  switch (focusMode) {
    case 'focused':
      return '专精凝意';
    case 'balanced':
      return '调和并济';
    case 'risky':
      return '险进催化';
  }
}

function buildConsumableName(
  family: PillFamily,
  element: ElementType,
): string {
  return `${ELEMENT_PREFIX_MAP[element]}${FAMILY_NAME_MAP[family]}`;
}

function buildDescription(
  materialNames: string[],
  userPrompt: string,
  stability: number,
  toxicityRating: number,
  focusMode: AlchemyFocusMode,
): string {
  return [
    `以${materialNames.join('、')}熔炼而成，丹意取向「${userPrompt.trim()}」。`,
    `此炉走${describeFocusMode(focusMode)}之势，稳度 ${stability}，丹毒评定 ${toxicityRating}。`,
  ].join('');
}

function buildBaseOperations(
  family: PillFamily,
  quality: Quality,
  trackPath?: Extract<ConditionTrackPath, `tempering.${string}`>,
): ConditionOperation[] {
  const scalar = getQualityScalar(quality);

  switch (family) {
    case 'mana':
      return [
        { type: 'restore_resource', resource: 'mp', mode: 'flat', value: Math.floor(90 * scalar) },
        { type: 'change_gauge', gauge: 'pillToxicity', delta: 3 },
      ];
    case 'breakthrough':
      return [
        {
          type: 'add_status',
          status: 'breakthrough_focus',
          usesRemaining: 1,
        },
        { type: 'change_gauge', gauge: 'pillToxicity', delta: 12 },
      ];
    case 'tempering':
      return [
        {
          type: 'advance_track',
          track: trackPath ?? 'tempering.vitality',
          value: Math.max(20, Math.floor(40 * scalar)),
        },
        { type: 'change_gauge', gauge: 'pillToxicity', delta: 10 },
      ];
    case 'marrow_wash':
      return [
        {
          type: 'advance_track',
          track: 'marrow_wash',
          value: Math.max(20, Math.floor(40 * scalar)),
        },
        { type: 'change_gauge', gauge: 'pillToxicity', delta: 14 },
      ];
    case 'detox':
      return [
        { type: 'change_gauge', gauge: 'pillToxicity', delta: -Math.floor(18 * scalar) },
      ];
    case 'hybrid':
      return [
        { type: 'restore_resource', resource: 'hp', mode: 'flat', value: Math.floor(80 * scalar) },
        { type: 'restore_resource', resource: 'mp', mode: 'flat', value: Math.floor(60 * scalar) },
        { type: 'change_gauge', gauge: 'pillToxicity', delta: 6 },
      ];
    case 'healing':
    default:
      return [
        { type: 'restore_resource', resource: 'hp', mode: 'flat', value: Math.floor(120 * scalar) },
        { type: 'change_gauge', gauge: 'pillToxicity', delta: 4 },
        {
          type: 'remove_status',
          status: scalar > 1.8 ? 'major_wound' : 'minor_wound',
        },
      ];
  }
}

function applyLowStabilityPenalty(
  operations: ConditionOperation[],
  family: PillFamily,
): ConditionOperation[] {
  return operations.map((operation) => {
    if (
      operation.type === 'restore_resource' ||
      operation.type === 'advance_track'
    ) {
      return {
        ...operation,
        value: Math.max(1, Math.floor(operation.value * 0.8)),
      };
    }

    if (
      family !== 'detox' &&
      operation.type === 'change_gauge' &&
      operation.gauge === 'pillToxicity' &&
      operation.delta > 0
    ) {
      return {
        ...operation,
        delta: operation.delta + 4,
      };
    }

    return operation;
  });
}

function buildOperationsFromSynthesis(
  family: PillFamily,
  quality: Quality,
  stability: number,
  trackPath?: Extract<ConditionTrackPath, `tempering.${string}`>,
): ConditionOperation[] {
  const operations = buildBaseOperations(family, quality, trackPath);
  if (stability >= 45) {
    return operations;
  }

  return applyLowStabilityPenalty(operations, family);
}

function familyComparator(
  left: [PillFamily, number],
  right: [PillFamily, number],
): number {
  if (right[1] !== left[1]) {
    return right[1] - left[1];
  }
  return FAMILY_PRIORITY[left[0]] - FAMILY_PRIORITY[right[0]];
}

function trackComparator(
  left: [Extract<ConditionTrackPath, `tempering.${string}`>, number],
  right: [Extract<ConditionTrackPath, `tempering.${string}`>, number],
): number {
  if (right[1] !== left[1]) {
    return right[1] - left[1];
  }
  return TRACK_PRIORITY[left[0]] - TRACK_PRIORITY[right[0]];
}

function getTargetFamilies(
  targetTags: MaterialAlchemyEffectTag[],
): Set<Exclude<PillFamily, 'hybrid'>> {
  return new Set(targetTags.map(getMaterialAlchemyTagFamily));
}

function getTagMultiplier(
  tag: MaterialAlchemyEffectTag,
  targetTags: MaterialAlchemyEffectTag[],
  targetFamilies: Set<Exclude<PillFamily, 'hybrid'>>,
): number {
  if (targetTags.includes(tag)) {
    return 1.5;
  }

  if (targetFamilies.has(getMaterialAlchemyTagFamily(tag))) {
    return 1.15;
  }

  return 1;
}

function buildIngredients(
  materialRows: MaterialRow[],
  materialQuantities?: Record<string, number>,
): PreparedAlchemyIngredient[] {
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
      type: material.type as AlchemyMaterialType,
      dose: normalizeDose(material, materialQuantities),
      profile,
    };
  });
}

function summarizeIngredientMix(
  ingredients: PreparedAlchemyIngredient[],
): {
  distinctFamilies: Set<Exclude<PillFamily, 'hybrid'>>;
  weightedAverageStability: number;
  weightedAverageToxicity: number;
} {
  let totalContribution = 0;
  let stabilitySum = 0;
  let toxicitySum = 0;
  const distinctFamilies = new Set<Exclude<PillFamily, 'hybrid'>>();

  for (const ingredient of ingredients) {
    const contribution = ingredient.dose * ingredient.profile.potency;
    totalContribution += contribution;
    stabilitySum += contribution * ingredient.profile.stability;
    toxicitySum += contribution * ingredient.profile.toxicity;

    for (const tag of ingredient.profile.effectTags) {
      distinctFamilies.add(getMaterialAlchemyTagFamily(tag));
    }
  }

  if (totalContribution <= 0) {
    return {
      distinctFamilies,
      weightedAverageStability: 0,
      weightedAverageToxicity: 0,
    };
  }

  return {
    distinctFamilies,
    weightedAverageStability: stabilitySum / totalContribution,
    weightedAverageToxicity: toxicitySum / totalContribution,
  };
}

function buildPreviewWarnings(
  ingredients: PreparedAlchemyIngredient[],
): string[] {
  const warnings: string[] = [];
  const {
    distinctFamilies,
    weightedAverageStability,
    weightedAverageToxicity,
  } = summarizeIngredientMix(ingredients);

  const estimatedStability = clamp(
    weightedAverageStability - 8 * Math.max(0, distinctFamilies.size - 1),
    15,
    95,
  );
  const estimatedToxicity = clamp(
    weightedAverageToxicity + Math.max(0, 55 - estimatedStability) / 2,
    0,
    100,
  );

  if (distinctFamilies.size >= 3 || estimatedStability < 45) {
    warnings.push('材料药性过散，预计炉性偏浮，成丹稳度可能偏低。');
  }
  if (
    Array.from(distinctFamilies).some((family) =>
      LONG_TERM_FAMILIES.has(family as LongTermFamily),
    )
  ) {
    warnings.push('此炉偏向长期丹效，若成丹可能计入本境长期丹药配额。');
  }
  if (estimatedToxicity >= 12) {
    warnings.push('药底燥烈，预计丹毒偏高，服用后需留意调息。');
  }

  return warnings;
}

function chooseDominantElement(
  elementScores: Map<ElementType, number>,
  requestedElementBias?: ElementType,
): ElementType {
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

export function synthesizeAlchemy(
  ingredients: PreparedAlchemyIngredient[],
  intent: AlchemyIntentResolution,
  quality: Quality,
): AlchemySynthesisResult {
  const familyScores = new Map<PillFamily, number>();
  const trackScores = new Map<
    Extract<ConditionTrackPath, `tempering.${string}`>,
    number
  >();
  const elementScores = new Map<ElementType, number>();
  const targetFamilies = getTargetFamilies(intent.targetTags);
  let totalContribution = 0;
  let stabilitySum = 0;
  let toxicitySum = 0;
  const distinctFamilies = new Set<Exclude<PillFamily, 'hybrid'>>();

  for (const ingredient of ingredients) {
    const contribution = ingredient.dose * ingredient.profile.potency;
    totalContribution += contribution;
    stabilitySum += contribution * ingredient.profile.stability;
    toxicitySum += contribution * ingredient.profile.toxicity;
    elementScores.set(
      ingredient.element,
      (elementScores.get(ingredient.element) ?? 0) + contribution,
    );

    for (const tag of ingredient.profile.effectTags) {
      const family = getMaterialAlchemyTagFamily(tag);
      const score =
        contribution * getTagMultiplier(tag, intent.targetTags, targetFamilies);

      familyScores.set(family, (familyScores.get(family) ?? 0) + score);
      distinctFamilies.add(family);

      const trackPath = getMaterialAlchemyTrackPath(tag);
      if (trackPath) {
        trackScores.set(trackPath, (trackScores.get(trackPath) ?? 0) + score);
      }
    }
  }

  if (familyScores.size === 0 || totalContribution <= 0) {
    throw new AlchemyServiceError('丹意未明，请稍后重试。', 503);
  }

  const sortedFamilies = [...familyScores.entries()].sort(familyComparator);
  const [firstFamily, secondFamily] = sortedFamilies;
  let family = firstFamily?.[0] ?? 'healing';

  if (
    firstFamily &&
    secondFamily &&
    SHORT_TERM_FAMILIES.has(firstFamily[0] as ShortTermFamily) &&
    SHORT_TERM_FAMILIES.has(secondFamily[0] as ShortTermFamily) &&
    secondFamily[1] >= firstFamily[1] * 0.85
  ) {
    family = 'hybrid';
  }

  const weightedAverageStability = stabilitySum / totalContribution;
  const stability = Math.round(
    clamp(
      weightedAverageStability - 8 * Math.max(0, distinctFamilies.size - 1),
      15,
      95,
    ),
  );
  const weightedAverageToxicity = toxicitySum / totalContribution;
  const toxicityRating = Math.round(
    clamp(
      weightedAverageToxicity + Math.max(0, 55 - stability) / 2,
      0,
      100,
    ),
  );
  const dominantElement = chooseDominantElement(
    elementScores,
    intent.requestedElementBias,
  );

  const trackPath =
    family === 'tempering'
      ? ([...trackScores.entries()].sort(trackComparator)[0]?.[0] ??
        'tempering.vitality')
      : undefined;

  return {
    family,
    dominantElement,
    stability,
    toxicityRating,
    operations: buildOperationsFromSynthesis(
      family,
      quality,
      stability,
      trackPath,
    ),
    trackPath,
  };
}

function buildAlchemySpec(
  synthesis: AlchemySynthesisResult,
  materialNames: string[],
  targetTags: MaterialAlchemyEffectTag[],
): PillSpec {
  return {
    kind: 'pill',
    family: synthesis.family,
    operations: synthesis.operations,
    consumeRules: {
      scene: 'out_of_battle_only',
      countsTowardLongTermQuota: countsTowardsQuota(synthesis.family),
    },
    alchemyMeta: {
      source: 'improvised',
      sourceMaterials: materialNames,
      dominantElement: synthesis.dominantElement,
      stability: synthesis.stability,
      toxicityRating: synthesis.toxicityRating,
      tags: Array.from(
        new Set([
          ...targetTags,
          synthesis.family,
        ]),
      ),
    },
  };
}

async function loadPreviewMaterialRows(
  cultivatorId: string,
  materialIds: string[],
): Promise<{ rows: MaterialRow[]; blockingReason?: string }> {
  const rows = sortRowsByRequestedIds(
    await getExecutor()
      .select()
      .from(materials)
      .where(inArray(materials.id, materialIds)),
    materialIds,
  );

  if (rows.length !== materialIds.length) {
    return {
      rows: [],
      blockingReason: '部分材料已耗尽或不存在。',
    };
  }

  if (rows.some((row) => row.cultivatorId !== cultivatorId)) {
    return {
      rows: [],
      blockingReason: '非本人材料，不可动用。',
    };
  }

  return { rows };
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

function buildSelectionValidation(
  materialRows: MaterialRow[],
): AlchemySelectionValidation {
  for (const material of materialRows) {
    if (!material.element) {
      return createValidation(
        false,
        `材料 ${material.name} 缺少五行属性，当前无法入炉。`,
      );
    }
    if (!isAlchemyMaterialType(material.type as MaterialType)) {
      return createValidation(
        false,
        `材料 ${material.name} 不可用于炼丹。`,
      );
    }

    const profile = readMaterialAlchemyProfile(
      (material.details ?? undefined) as MaterialDetails | undefined,
    );
    if (!profile) {
      return createValidation(
        false,
        `材料 ${material.name} 缺少药性画像，请清空旧库存后重试。`,
      );
    }
  }

  const ingredients = buildIngredients(materialRows);
  return createValidation(true, undefined, buildPreviewWarnings(ingredients));
}

export async function previewAlchemySelection(
  cultivatorId: string,
  availableSpiritStones: number,
  materialIds: string[],
): Promise<AlchemyPreviewResult> {
  const { rows, blockingReason } = await loadPreviewMaterialRows(
    cultivatorId,
    materialIds,
  );

  if (blockingReason) {
    return {
      cost: { spiritStones: 0 },
      canAfford: true,
      validation: createValidation(false, blockingReason),
    };
  }

  const highestMaterialRank = pickHighestRank(rows);
  const spiritStones = highestMaterialRank
    ? calculateCraftCost(highestMaterialRank, 'spiritStone')
    : 0;
  const validation = buildSelectionValidation(rows);

  return {
    cost: { spiritStones },
    canAfford: availableSpiritStones >= spiritStones,
    validation,
  };
}

export function createAlchemyService(
  intentResolver: AlchemyIntentResolver,
) {
  return {
    async processAlchemyCraft(
      cultivatorId: string,
      materialIds: string[],
      options: {
        materialQuantities?: Record<string, number>;
        userPrompt?: string;
      } = {},
    ): Promise<ImprovisedAlchemyCraftResult> {
      const lockKey = `alchemy:lock:${cultivatorId}`;
      const acquired = await redis.set(lockKey, 'locked', 'EX', 30, 'NX');
      if (!acquired) {
        throw new AlchemyServiceError('丹炉已开，道友稍候片刻', 429);
      }

      try {
        const selectedMaterials = await loadOwnedMaterials(cultivatorId, materialIds);
        const [cultivator] = await getExecutor()
          .select()
          .from(cultivators)
          .where(eq(cultivators.id, cultivatorId))
          .limit(1);

        if (!cultivator) {
          throw new AlchemyServiceError('道友查无此人', 404);
        }

        const prompt = options.userPrompt?.trim();
        if (!prompt) {
          throw new AlchemyServiceError('请注入神念，描述丹药功效。');
        }

        const highestMaterialRank = calculateHighestMaterialRank(
          selectedMaterials as Array<{ rank: Quality }>,
        );
        const cost = calculateCraftCost(highestMaterialRank, 'spiritStone');

        if ((cultivator.spirit_stones ?? 0) < cost) {
          throw new AlchemyServiceError(`灵石不足，需要 ${cost} 枚`);
        }

        const ingredients = buildIngredients(
          selectedMaterials,
          options.materialQuantities,
        );

        let intent: AlchemyIntentResolution;
        try {
          intent = await intentResolver.resolve(prompt);
        } catch {
          throw new AlchemyServiceError('丹意未明，请稍后重试。', 503);
        }

        if (intent.targetTags.length === 0) {
          throw new AlchemyServiceError('丹意未明，请稍后重试。', 503);
        }

        const synthesis = synthesizeAlchemy(
          ingredients,
          intent,
          highestMaterialRank,
        );
        const spec = buildAlchemySpec(
          synthesis,
          ingredients.map((ingredient) => ingredient.name),
          intent.targetTags,
        );
        const consumable: Consumable = {
          name: buildConsumableName(
            synthesis.family,
            synthesis.dominantElement,
          ),
          type: '丹药',
          quality: highestMaterialRank,
          quantity: 1,
          prompt,
          description: buildDescription(
            ingredients.map((ingredient) => ingredient.name),
            prompt,
            synthesis.stability,
            synthesis.toxicityRating,
            intent.focusMode,
          ),
          spec,
        };
        consumable.score = calculateSingleElixirScore(consumable);

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
        const insertedRow = inserted.find(
          (row) => {
            try {
              return (
                serializeConsumableSpec(row.spec as Consumable['spec']) ===
                serializeConsumableSpec(spec)
              );
            } catch {
              return false;
            }
          },
        );

        const savedConsumable = insertedRow ? mapConsumableRow(insertedRow) : consumable;
        const formulaDiscovery = await buildDiscoveryCandidate(cultivatorId, {
          consumable: savedConsumable as Consumable & { spec: PillSpec },
          ingredients: ingredients.map((ingredient) => ({
            id: ingredient.id,
            name: ingredient.name,
            rank: ingredient.rank,
            element: ingredient.element,
            type: ingredient.type,
            dose: ingredient.dose,
            effectTags: ingredient.profile.effectTags,
            potency: ingredient.profile.potency,
          })),
          targetTags: intent.targetTags,
        });

        return {
          consumable: savedConsumable,
          formulaDiscovery: formulaDiscovery ?? undefined,
        };
      } finally {
        await redis.del(lockKey);
      }
    },
  };
}

const alchemyService = createAlchemyService(alchemyIntentResolver);

export const processAlchemyCraft = alchemyService.processAlchemyCraft;
