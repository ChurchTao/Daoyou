import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import {
  consumables,
  cultivators,
  materials,
} from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import {
  buildAlchemyBatchPreview,
  buildAlchemyPreviewWarnings,
  buildAlchemyPropertyTags,
  describeAlchemyPropertyVector,
  getQuotaCategoryForFamily,
  type PreparedAlchemyMaterial,
  synthesizeAlchemyFromPlan,
} from '@server/lib/services/AlchemyRecipeRules';
import { calculateSingleElixirScore } from '@server/utils/rankingUtils';
import { ELEMENT_PREFIX_MAP } from '@shared/config/alchemyConfig';
import {
  calculateCraftCost,
  calculateHighestMaterialRank,
} from '@shared/engine/creation-v2/CraftCostCalculator';
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
import { isAlchemyMaterialType } from '@shared/lib/alchemyMaterials';
import type {
  ElementType,
  MaterialType,
  Quality,
  RealmStage,
  RealmType,
} from '@shared/types/constants';
import type {
  AlchemyBatchPreview,
  AlchemyRecipePlan,
  PillSpec,
} from '@shared/types/consumable';
import type { Consumable, PreHeavenFate } from '@shared/types/cultivator';
import { and, eq, inArray } from 'drizzle-orm';
import { buildDiscoveryCandidate } from './AlchemyFormulaService';
import { AlchemyNarrativeEnricher } from './AlchemyNarrativeEnricher';
import {
  alchemyRecipePlanner,
  type AlchemyRecipePlanner,
} from './AlchemyRecipePlanner';
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

export { synthesizeAlchemyFromPlan as synthesizeAlchemy } from './AlchemyRecipeRules';
export { AlchemyServiceError } from './AlchemyServiceError';

type MaterialRow = typeof materials.$inferSelect;

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
  batchPreview: AlchemyBatchPreview;
}

export interface ImprovisedAlchemyCraftResult {
  consumable: Consumable;
  formulaDiscovery?: Awaited<ReturnType<typeof buildDiscoveryCandidate>>;
}

const alchemyNarrativeEnricher = new AlchemyNarrativeEnricher();

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

function describeFocusMode(focusMode: AlchemyRecipePlan['focusMode']): string {
  switch (focusMode) {
    case 'focused':
      return '专精凝意';
    case 'balanced':
      return '调和并济';
    case 'risky':
      return '险进催化';
  }
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
  return calculateHighestMaterialRank(materialRows as Array<{ rank: Quality }>);
}

function validateMaterialRow(material: MaterialRow): string | null {
  const mysteryReason = getMysteryMaterialBlockingReason([material]);
  if (mysteryReason) {
    return mysteryReason;
  }
  if (!material.element) {
    return `材料 ${material.name} 缺少五行属性，当前无法入炉。`;
  }
  if (!isAlchemyMaterialType(material.type as MaterialType)) {
    return `材料 ${material.name} 不可用于炼丹。`;
  }
  if (!material.description?.trim()) {
    return `材料 ${material.name} 缺少描述，当前无法判明药性。`;
  }
  return null;
}

function buildPreparedMaterial(
  material: MaterialRow,
  index: number,
  materialQuantities?: Record<string, number>,
): PreparedAlchemyMaterial {
  const error = validateMaterialRow(material);
  if (error) {
    throw new AlchemyServiceError(error, 400);
  }

  return {
    id: material.id,
    materialRef: `material_${index + 1}`,
    name: material.name,
    description: material.description?.trim() ?? '',
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

function buildSelectionValidation(
  materialRows: MaterialRow[],
  materialQuantities?: Record<string, number>,
): AlchemySelectionValidation {
  for (const material of materialRows) {
    const error = validateMaterialRow(material);
    if (error) {
      return createValidation(false, error);
    }
  }

  const preparedMaterials = buildPreparedMaterials(
    materialRows,
    materialQuantities,
  );
  return createValidation(
    true,
    undefined,
    buildAlchemyPreviewWarnings(preparedMaterials),
  );
}

function buildFallbackName(
  materialNames: string[],
  dominantElement: ElementType,
): string {
  const coreName = materialNames[0]?.slice(0, 6) || '无名';
  return `${ELEMENT_PREFIX_MAP[dominantElement]}${coreName}丹`;
}

function buildFallbackDescription(
  materialNames: string[],
  userPrompt: string,
  propertyVectorText: string,
  stability: number,
  toxicityRating: number,
  focusMode: AlchemyRecipePlan['focusMode'],
): string {
  return [
    `以${materialNames.join('、')}合炉，丹意取向「${userPrompt.trim()}」。`,
    `炉势走${describeFocusMode(focusMode)}之路，药性归于${propertyVectorText}，稳度 ${stability}，丹毒评定 ${toxicityRating}。`,
  ].join('');
}

function buildAlchemySpec(
  synthesis: ReturnType<typeof synthesizeAlchemyFromPlan>,
  materialNames: string[],
): PillSpec {
  return {
    kind: 'pill',
    family: synthesis.family,
    operations: synthesis.operations,
    consumeRules: {
      scene: 'out_of_battle_only',
      quotaCategory: getQuotaCategoryForFamily(synthesis.family),
    },
    alchemyMeta: {
      source: 'improvised',
      sourceMaterials: materialNames,
      analysisVersion: 2,
      propertyVector: synthesis.propertyVector,
      sourceMaterialVectors: synthesis.sourceMaterialVectors,
      dominantElement: synthesis.dominantElement,
      stability: synthesis.stability,
      toxicityRating: synthesis.toxicityRating,
      appearance: synthesis.appearance,
      tags: buildAlchemyPropertyTags(
        synthesis.propertyVector,
        synthesis.family,
      ),
      batch: synthesis.batchProfile,
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
  const mysteryReason = getMysteryMaterialBlockingReason(rows);
  if (mysteryReason) {
    throw new AlchemyServiceError(mysteryReason, 400);
  }

  return rows;
}

export async function previewAlchemySelection(
  cultivatorId: string,
  availableSpiritStones: number,
  materialIds: string[],
  fates: PreHeavenFate[] = [],
  materialQuantities?: Record<string, number>,
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
      batchPreview: buildAlchemyBatchPreview([]),
    };
  }

  const highestMaterialRank = pickHighestRank(rows);
  const fateContext = evaluateFateContext(fates);
  const spiritStones = highestMaterialRank
    ? scaleFateAdjustedValue(
        calculateCraftCost(highestMaterialRank, 'spiritStone'),
        getAlchemySpiritStoneMultiplier(fateContext),
      )
    : 0;

  const validation = buildSelectionValidation(rows, materialQuantities);
  const preparedMaterials = validation.valid
    ? buildPreparedMaterials(rows, materialQuantities)
    : [];
  return {
    cost: { spiritStones },
    canAfford: availableSpiritStones >= spiritStones,
    validation,
    batchPreview: buildAlchemyBatchPreview(preparedMaterials),
  };
}

export function createAlchemyService(
  planner: Pick<AlchemyRecipePlanner, 'plan'> = alchemyRecipePlanner,
) {
  return {
    async processAlchemyCraft(
      cultivatorId: string,
      materialIds: string[],
      options: {
        materialQuantities?: Record<string, number>;
        userPrompt?: string;
        tx?: DbTransaction;
      } = {},
    ): Promise<ImprovisedAlchemyCraftResult> {
      const lockKey = `alchemy:lock:${cultivatorId}`;
      const acquired = await redis.set(lockKey, 'locked', 'EX', 30, 'NX');
      if (!acquired) {
        throw new AlchemyServiceError('丹炉已开，道友稍候片刻', 429);
      }

      try {
        const [selectedMaterials, cultivator, fullCultivator] =
          await Promise.all([
            loadOwnedMaterials(cultivatorId, materialIds),
            (options.tx ?? getExecutor())
              .select()
              .from(cultivators)
              .where(eq(cultivators.id, cultivatorId))
              .limit(1)
              .then((rows) => rows[0]),
            getCultivatorByIdUnsafe(cultivatorId, options.tx),
          ]);

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
        const fateContext = evaluateFateContext(
          fullCultivator?.cultivator.pre_heaven_fates ?? [],
        );
        const cost = scaleFateAdjustedValue(
          calculateCraftCost(highestMaterialRank, 'spiritStone'),
          getAlchemySpiritStoneMultiplier(fateContext),
        );

        if ((cultivator.spirit_stones ?? 0) < cost) {
          throw new AlchemyServiceError(`灵石不足，需要 ${cost} 枚`);
        }

        const preparedMaterials = buildPreparedMaterials(
          selectedMaterials,
          options.materialQuantities,
        );

        let recipePlan: AlchemyRecipePlan;
        try {
          recipePlan = await planner.plan({
            materials: preparedMaterials,
            userPrompt: prompt,
          });
        } catch {
          throw new AlchemyServiceError('丹意未明，请稍后重试。', 503);
        }

        const cultivationProgress = cultivator.cultivation_progress as
          | { exp_cap?: number }
          | null
          | undefined;
        const synthesis = synthesizeAlchemyFromPlan(
          preparedMaterials,
          recipePlan,
          highestMaterialRank,
          {
            realm: cultivator.realm as RealmType,
            realmStage: (cultivator.realm_stage ?? '初期') as RealmStage,
            expCap: cultivationProgress?.exp_cap,
          },
        );
        const breakthroughTargetRealm =
          synthesis.family === 'breakthrough'
            ? getNextMajorRealm(cultivator.realm as RealmType)
            : null;
        const spec = buildAlchemySpec(
          synthesis,
          preparedMaterials.map((material) => material.name),
        );

        const usesFixedBreakthroughName =
          synthesis.family === 'breakthrough' &&
          breakthroughTargetRealm !== null &&
          hasBreakthroughFocusEffect(spec.operations);

        if (usesFixedBreakthroughName) {
          spec.alchemyMeta.breakthroughTargetRealm = breakthroughTargetRealm;
          spec.alchemyMeta.breakthroughLabel = getBreakthroughPillLabel(
            breakthroughTargetRealm,
          );
        } else if (
          synthesis.family === 'breakthrough' &&
          breakthroughTargetRealm
        ) {
          spec.alchemyMeta.breakthroughTargetRealm = breakthroughTargetRealm;
        }
        const generatedCopy =
          await alchemyNarrativeEnricher.generateImprovisedPillCopy({
            family: synthesis.family,
            dominantElement: synthesis.dominantElement,
            quality: highestMaterialRank,
            materialNames: preparedMaterials.map((material) => material.name),
            propertyVector: synthesis.propertyVector,
            operations: spec.operations,
            stability: synthesis.stability,
            toxicityRating: synthesis.toxicityRating,
            userPrompt: prompt,
            focusMode: synthesis.focusMode,
          });
        const resolvedName = usesFixedBreakthroughName
          ? getBreakthroughPillLabel(breakthroughTargetRealm)
          : (generatedCopy?.name ??
            buildFallbackName(
              preparedMaterials.map((material) => material.name),
              synthesis.dominantElement,
            ));
        const consumable: Consumable = {
          name: resolvedName,
          type: '丹药',
          quality: highestMaterialRank,
          quantity: synthesis.batchProfile.yieldQuantity,
          prompt,
          description:
            generatedCopy?.description ??
            buildFallbackDescription(
              preparedMaterials.map((material) => material.name),
              prompt,
              describeAlchemyPropertyVector(synthesis.propertyVector),
              synthesis.stability,
              synthesis.toxicityRating,
              synthesis.focusMode,
            ),
          spec,
        };
        consumable.score = calculateSingleElixirScore(consumable);

        const writeAlchemy = async (tx: DbTransaction) => {
          for (const material of preparedMaterials) {
            const row = selectedMaterials.find(
              (item) => item.id === material.id,
            );
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
        };

        if (options.tx) {
          await writeAlchemy(options.tx);
        } else {
          await getExecutor().transaction(writeAlchemy);
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

        const savedConsumable = insertedRow
          ? mapConsumableRow(insertedRow)
          : consumable;
        const formulaDiscovery = await buildDiscoveryCandidate(cultivatorId, {
          consumable: savedConsumable as Consumable & { spec: PillSpec },
          materials: preparedMaterials,
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

const alchemyService = createAlchemyService();

export const processAlchemyCraft = alchemyService.processAlchemyCraft;
