import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import { cultivators, materials } from '@server/lib/drizzle/schema';
import {
  buildAlchemyPropertyTags,
  describeAlchemyPropertyVector,
  getQuotaCategoryForFamily,
  synthesizeAlchemyFromPlan,
  type PreparedAlchemyMaterial,
} from '@server/lib/services/AlchemyRecipeRules';
import {
  addConsumableToInventoryInTransaction,
  mapMaterialRow,
} from '@server/lib/services/cultivator/CultivatorInventoryRepository';
import { getCultivatorPreHeavenFates } from '@server/lib/services/cultivator/CultivatorProfileRepository';
import { ELEMENT_PREFIX_MAP } from '@shared/config/alchemyConfig';
import {
  calculateCraftCost,
  calculateHighestMaterialRank,
} from '@shared/engine/creation-v2/CraftCostCalculator';
import type { ResourceOperationSettlement } from '@shared/engine/resource/types';
import { normalizeAlchemyEffectRoute } from '@shared/lib/alchemyEffectResolver';
import { isAlchemyMaterialType } from '@shared/lib/alchemyMaterials';
import {
  calculateAlchemyQiCost,
  rollAlchemyYieldProfile,
  toAlchemyYieldDisplayProfile,
} from '@shared/lib/alchemyYield';
import {
  getBreakthroughPillLabel,
  getNextMajorRealm,
} from '@shared/lib/breakthroughPill';
import {
  evaluateFateContext,
  getAlchemySpiritStoneMultiplier,
  scaleFateAdjustedCost,
} from '@shared/lib/fates';
import type {
  ElementType,
  MaterialType,
  Quality,
  RealmType,
} from '@shared/types/constants';
import type { AlchemyRecipePlan, PillSpec } from '@shared/types/consumable';
import type { Consumable, PreHeavenFate } from '@shared/types/cultivator';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  assembleAlchemyOutputConsumables,
  type AlchemyOutputDraft,
} from './alchemy/AlchemyOutputAssembler';
import { buildDiscoveryCandidate } from './AlchemyFormulaService';
import { AlchemyNarrativeEnricher } from './AlchemyNarrativeEnricher';
import {
  alchemyRecipePlanner,
  type AlchemyRecipePlanner,
} from './AlchemyRecipePlanner';
import { AlchemyServiceError } from './AlchemyServiceError';
import { getMysteryMaterialBlockingReason } from './materialMysteryGuard';
import { sectOrganizationFacade } from './sect-organization';

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
    qi: number;
  };
  canAfford: boolean;
  validation: AlchemySelectionValidation;
}

export interface ImprovisedAlchemyCraftResult {
  consumable: Consumable;
  consumables?: Consumable[];
  /** 本炉新增数量，不能使用合堆后的库存行作为结果展示数据。 */
  craftedConsumables?: Consumable[];
  yieldProfile?: import('@shared/types/consumable').AlchemyYieldDisplayProfile;
  formulaDiscovery?: Awaited<ReturnType<typeof buildDiscoveryCandidate>>;
}

export interface PreparedImprovisedAlchemyCraft {
  qiCost: number;
  commit(tx: DbTransaction): Promise<{
    result: ImprovisedAlchemyCraftResult;
    inventoryChanges: ResourceOperationSettlement['inventoryChanges'];
    afterCommit: () => Promise<void>;
  }>;
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
): AlchemySelectionValidation {
  for (const material of materialRows) {
    const error = validateMaterialRow(material);
    if (error) {
      return createValidation(false, error);
    }
  }
  return createValidation(true);
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
  route: import('@shared/types/consumable').AlchemyEffectRoute,
): Omit<PillSpec, 'operations'> {
  return {
    kind: 'pill',
    family: synthesis.family,
    consumeRules: {
      scene: 'out_of_battle_only',
      quotaCategory: getQuotaCategoryForFamily(synthesis.family),
    },
    alchemyMeta: {
      source: 'improvised',
      version: 4,
      sourceMaterials: materialNames,
      analysisVersion: 2,
      propertyVector: route.effects,
      sourceMaterialVectors: synthesis.sourceMaterialVectors,
      dominantElement: synthesis.dominantElement,
      stability: synthesis.stability,
      toxicityRating: synthesis.toxicityRating,
      // 批次生成前的中性占位；最终品相由产出引擎逐枚生成并覆盖。
      appearance: 'middle',
      tags: buildAlchemyPropertyTags(route.effects, synthesis.family),
      batch: (() => {
        const persisted = { ...synthesis.batchProfile };
        delete persisted.essenceSummary;
        delete persisted.yieldProfile;
        return persisted;
      })(),
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
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<MaterialRow[]> {
  const rows = sortRowsByRequestedIds(
    await q.select().from(materials).where(inArray(materials.id, materialIds)),
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
      cost: { spiritStones: 0, qi: 1 },
      canAfford: true,
      validation: createValidation(false, blockingReason),
    };
  }

  const highestMaterialRank = pickHighestRank(rows);
  const fateContext = evaluateFateContext(fates);
  const baseSpiritStones = highestMaterialRank
    ? scaleFateAdjustedCost(
        calculateCraftCost(highestMaterialRank, 'spiritStone'),
        getAlchemySpiritStoneMultiplier(fateContext),
      )
    : 0;
  const spiritStones = await sectOrganizationFacade.applyCraftDiscount(
    cultivatorId,
    baseSpiritStones,
    'sect.craft.alchemy',
  );

  const validation = buildSelectionValidation(rows);
  const preparedMaterials = validation.valid
    ? buildPreparedMaterials(rows, materialQuantities)
    : [];
  return {
    cost: {
      spiritStones,
      qi: calculateAlchemyQiCost(preparedMaterials),
    },
    canAfford: availableSpiritStones >= spiritStones,
    validation,
  };
}

export function createAlchemyService(
  planner: Pick<AlchemyRecipePlanner, 'plan'> = alchemyRecipePlanner,
) {
  const prepareAlchemyCraft = async (
    cultivatorId: string,
    materialIds: string[],
    options: {
      materialQuantities?: Record<string, number>;
      userPrompt?: string;
    } = {},
  ): Promise<PreparedImprovisedAlchemyCraft> => {
    const q = getExecutor();
    const [selectedMaterials, cultivator, preHeavenFates] = await Promise.all([
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
    const fateContext = evaluateFateContext(preHeavenFates);
    const baseCost = scaleFateAdjustedCost(
      calculateCraftCost(highestMaterialRank, 'spiritStone'),
      getAlchemySpiritStoneMultiplier(fateContext),
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

    const preparedMaterials = buildPreparedMaterials(
      selectedMaterials,
      options.materialQuantities,
    );
    const qiCost = calculateAlchemyQiCost(preparedMaterials);

    let recipePlan: AlchemyRecipePlan;
    try {
      recipePlan = await planner.plan({
        materials: preparedMaterials,
        userPrompt: prompt,
      });
    } catch {
      throw new AlchemyServiceError('丹意未明，请稍后重试。', 503);
    }

    const synthesis = synthesizeAlchemyFromPlan(preparedMaterials, recipePlan);
    const breakthroughTargetRealm =
      synthesis.family === 'breakthrough'
        ? getNextMajorRealm(cultivator.realm as RealmType)
        : null;
    const route = normalizeAlchemyEffectRoute({
      effects: synthesis.propertyVector,
    });
    const spec = buildAlchemySpec(
      synthesis,
      preparedMaterials.map((material) => material.name),
      route,
    );

    const usesFixedBreakthroughName =
      synthesis.family === 'breakthrough' &&
      breakthroughTargetRealm !== null &&
      route.effects.some((effect) => effect.key === 'breakthrough_support');

    if (usesFixedBreakthroughName) {
      spec.alchemyMeta.breakthroughTargetRealm = breakthroughTargetRealm;
      spec.alchemyMeta.breakthroughLabel = getBreakthroughPillLabel(
        breakthroughTargetRealm,
      );
    } else if (synthesis.family === 'breakthrough' && breakthroughTargetRealm) {
      spec.alchemyMeta.breakthroughTargetRealm = breakthroughTargetRealm;
    }
    const generatedCopy =
      await alchemyNarrativeEnricher.generateImprovisedPillCopy({
        family: synthesis.family,
        dominantElement: synthesis.dominantElement,
        quality: highestMaterialRank,
        materialNames: preparedMaterials.map((material) => material.name),
        propertyVector: route.effects,
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
    const draft: AlchemyOutputDraft = {
      name: resolvedName,
      type: '丹药',
      prompt,
      description:
        generatedCopy?.description ??
        buildFallbackDescription(
          preparedMaterials.map((material) => material.name),
          prompt,
          describeAlchemyPropertyVector(route.effects),
          synthesis.stability,
          synthesis.toxicityRating,
          synthesis.focusMode,
        ),
      spec,
      route,
      fitMultiplier: 1,
    };
    return {
      qiCost,
      async commit(tx: DbTransaction) {
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
            current.quantity !== expected.quantity ||
            current.rank !== expected.rank ||
            current.type !== expected.type ||
            current.element !== expected.element
          ) {
            throw new AlchemyServiceError(
              '材料已发生变化，请重新确认配方。',
              409,
            );
          }
        }

        // The final distribution is deliberately rolled inside the transaction.
        // Preview/prepare may be retried, but only a confirmed command consumes RNG.
        const yieldProfile = rollAlchemyYieldProfile({
          materials: preparedMaterials,
          factors: {
            synergyScore: synthesis.batchProfile.synergyScore,
            conflictScore: synthesis.batchProfile.conflictScore,
            stability: synthesis.stability,
            purity: synthesis.batchProfile.essenceSummary?.purity,
          },
        });
        const outputConsumables = assembleAlchemyOutputConsumables(
          draft,
          yieldProfile,
        );
        if (outputConsumables.length === 0) {
          throw new AlchemyServiceError('本炉药蕴不足，无法凝成丹药。', 400);
        }
        const primaryConsumable = outputConsumables[0]!;

        for (const id of stableMaterialIds) {
          const prepared = preparedMaterials.find((item) => item.id === id);
          const expected = expectedById.get(id);
          if (!prepared || !expected) {
            throw new AlchemyServiceError('材料记录异常，无法扣除', 500);
          }

          if (prepared.dose >= expected.quantity) {
            const deleted = await tx
              .delete(materials)
              .where(
                and(
                  eq(materials.id, id),
                  eq(materials.cultivatorId, cultivatorId),
                  eq(materials.quantity, expected.quantity),
                ),
              )
              .returning({ id: materials.id });
            if (deleted.length !== 1) {
              throw new AlchemyServiceError(
                '材料已发生变化，请重新确认配方。',
                409,
              );
            }
            inventoryChanges.push({
              kind: 'materials',
              operation: 'remove',
              id,
            });
          } else {
            const updated = await tx
              .update(materials)
              .set({
                quantity: sql`${materials.quantity} - ${prepared.dose}`,
              })
              .where(
                and(
                  eq(materials.id, id),
                  eq(materials.cultivatorId, cultivatorId),
                  eq(materials.quantity, expected.quantity),
                ),
              )
              .returning();
            if (updated.length !== 1) {
              throw new AlchemyServiceError(
                '材料已发生变化，请重新确认配方。',
                409,
              );
            }
            inventoryChanges.push({
              kind: 'materials',
              operation: 'upsert',
              item: mapMaterialRow(updated[0]),
            });
          }
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

        const savedConsumables: Consumable[] = [];
        for (const output of outputConsumables) {
          const saved = await addConsumableToInventoryInTransaction(
            cultivatorId,
            output,
            tx,
          );
          savedConsumables.push(saved);
          inventoryChanges.push({
            kind: 'consumables',
            operation: 'upsert',
            item: saved,
          });
        }
        const result: ImprovisedAlchemyCraftResult = {
          consumable: primaryConsumable,
          consumables: savedConsumables,
          craftedConsumables: outputConsumables,
          yieldProfile: toAlchemyYieldDisplayProfile(yieldProfile),
        };
        return {
          result,
          inventoryChanges,
          afterCommit: async () => {
            const formulaDiscovery = await buildDiscoveryCandidate(
              cultivatorId,
              {
                consumable: primaryConsumable as Consumable & {
                  spec: PillSpec;
                },
                materials: preparedMaterials,
              },
            );
            result.formulaDiscovery = formulaDiscovery ?? undefined;
          },
        };
      },
    };
  };

  return { prepareAlchemyCraft };
}

const alchemyService = createAlchemyService();

export const prepareAlchemyCraft = alchemyService.prepareAlchemyCraft;
