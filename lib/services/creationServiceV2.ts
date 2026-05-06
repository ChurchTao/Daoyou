import { DefaultMaterialAnalyzer } from '@/engine/creation-v2/analysis/DefaultMaterialAnalyzer';
import { MaterialFactsBuilder } from '@/engine/creation-v2/analysis/MaterialFactsBuilder';
import { CreationOrchestrator } from '@/engine/creation-v2/CreationOrchestrator';
import { CreationAbilityAdapter } from '@/engine/creation-v2/adapters/CreationAbilityAdapter';
import { getCreationProductTypeFromCraftType } from '@/engine/creation-v2/config/CreationCraftPolicy';
import { CREATION_INPUT_CONSTRAINTS } from '@/engine/creation-v2/config/CreationBalance';
import {
  deserializeCraftedOutcomeSnapshot,
  restoreCraftedOutcome,
  serializeCraftedOutcomeSnapshot,
  snapshotCraftedOutcome,
} from '@/engine/creation-v2/persistence/OutcomeSnapshot';
import { toRow } from '@/engine/creation-v2/persistence/ProductPersistenceMapper';
import { MaterialRuleSet } from '@/engine/creation-v2/rules/material/MaterialRuleSet';
import { supportsProductType } from '@/engine/creation-v2/rules/recipe/ProductSupportRules';
import type { CreationProductType } from '@/engine/creation-v2/types';
import {
  calculateCraftCost,
  calculateMaxQuality,
} from '@/engine/creation-v2/CraftCostCalculator';
import { getExecutor } from '@/lib/drizzle/db';
import { cultivators, materials } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import * as creationProductRepository from '@/lib/repositories/creationProductRepository';
import type { EquipmentSlot, Quality, RealmStage, RealmType } from '@/types/constants';
import type { Material } from '@/types/cultivator';
import { eq, inArray, sql } from 'drizzle-orm';
import { getCultivatorByIdUnsafe } from './cultivatorService';
import { FateEngine } from './FateEngine';

const MAX_GONGFA = 5;

/**
 * processCreation 时的玩家侧可选入参。
 *
 * 设计原则：只开放“玩家必须主动决定”的旋钮，其它（元素倾向 / 语义标签 / LLM 命名是否开启）
 * 一律由材料与引擎决定，避免把复杂的引擎配置暴露给终端玩家。
 */
export interface ProcessCreationOptions {
  /** 每个材料本次炼制实际消耗数量，未传则默认 1。会被夹紧到 [1, maxQuantityPerMaterial]。 */
  materialQuantities?: Record<string, number>;
  /** 玩家自由书写的命名/风格提示，仅影响 LLM 命名文案，不改变数值。 */
  userPrompt?: string;
  /** 仅法宝有效：玩家指定的装备槽位。其它产物传入会被忽略。 */
  requestedSlot?: EquipmentSlot;
  /** 仅神通有效：玩家指定的目标策略（单体/AOE/队友等）。其它产物传入会被忽略。 */
  requestedTargetPolicy?: { team: 'enemy' | 'ally' | 'self' | 'any'; scope: 'single' | 'aoe' | 'random'; maxTargets?: number };
}

export class CreationServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = 'CreationServiceError';
  }
}

export interface CreationV2Result {
  id: string;
  productType: CreationProductType;
  name: string;
  description: string | null;
  element: string | null;
  quality: string | null;
  slot: string | null;
  score: number;
  /** 词缀摘要（来自 product_model.affixes），供前端结果页展示 */
  affixes: Array<{
    id: string;
    name: string;
    category: string;
    isPerfect: boolean;
    rollEfficiency: number;
  }>;
  needs_replace?: boolean;
  currentCount?: number;
  maxCount?: number;
}

export interface PendingCreationItem {
  snapshot: string;
  productType: CreationProductType;
  previewName: string;
  previewElement: string | null;
  previewQuality: string | null;
}

export interface CreationPreviewValidation {
  valid: boolean;
  blockingReason?: string;
  warnings: string[];
  missingMatchingManual: boolean;
}

type MaterialRow = typeof materials.$inferSelect;

const orchestrator = new CreationOrchestrator();
const materialAnalyzer = new DefaultMaterialAnalyzer();
const materialFactsBuilder = new MaterialFactsBuilder();
const materialRuleSet = new MaterialRuleSet();

const PRODUCT_TYPE_LABELS: Record<CreationProductType, string> = {
  artifact: '法宝',
  skill: '神通',
  gongfa: '功法',
};

const MISSING_MATCHING_MANUAL_WARNING_CODES = new Set([
  'skill-missing-manual',
  'gongfa-missing-manual',
]);

function toCreationMaterial(
  material: MaterialRow,
  quantityOverride?: number,
): Material {
  return {
    id: material.id,
    name: material.name,
    type: material.type as Material['type'],
    rank: material.rank as Quality,
    element: (material.element ?? undefined) as Material['element'],
    description: material.description ?? undefined,
    details: (material.details ?? undefined) as Material['details'],
    quantity: quantityOverride ?? Math.max(1, material.quantity ?? 1),
  };
}

function toCreationMaterials(
  selectedMaterials: MaterialRow[],
  quantityOverrides?: Map<string, number>,
): Material[] {
  return selectedMaterials.map((material) =>
    toCreationMaterial(material, quantityOverrides?.get(material.id)),
  );
}

async function loadOwnedMaterials(
  cultivatorId: string,
  materialIds: string[],
): Promise<MaterialRow[]> {
  const selectedMaterials = await getExecutor()
    .select()
    .from(materials)
    .where(inArray(materials.id, materialIds));

  if (selectedMaterials.length !== materialIds.length) {
    throw new CreationServiceError('部分材料已耗尽或不存在');
  }

  for (const material of selectedMaterials) {
    if (material.cultivatorId !== cultivatorId) {
      throw new CreationServiceError('非本人材料，不可动用', 403);
    }
  }

  return selectedMaterials;
}

function buildCreationPreviewValidation(
  productType: CreationProductType,
  selectedMaterials: Material[],
): CreationPreviewValidation {
  const fingerprints = materialAnalyzer.analyze(selectedMaterials);
  const materialFacts = materialFactsBuilder.build(productType, fingerprints);
  const materialDecision = materialRuleSet.evaluate(materialFacts);
  const warnings = materialDecision.warnings.map((warning) => warning.message);
  const missingMatchingManual = materialDecision.warnings.some((warning) =>
    MISSING_MATCHING_MANUAL_WARNING_CODES.has(warning.code),
  );

  if (!materialDecision.valid) {
    return {
      valid: false,
      blockingReason:
        materialDecision.notes[0] ??
        materialDecision.reasons[0]?.message ??
        '当前材料组合不合法',
      warnings,
      missingMatchingManual,
    };
  }

  if (!supportsProductType(productType, materialDecision.recipeTags)) {
    return {
      valid: false,
      blockingReason: `当前材料组合不足以支撑${PRODUCT_TYPE_LABELS[productType]}成型`,
      warnings,
      missingMatchingManual,
    };
  }

  return {
    valid: true,
    warnings,
    missingMatchingManual,
  };
}

export async function previewCreationSelection(
  cultivatorId: string,
  materialIds: string[],
  craftType: string,
): Promise<{
  productType: CreationProductType;
  materials: MaterialRow[];
  validation: CreationPreviewValidation;
}> {
  const productType = getCreationProductTypeFromCraftType(craftType);
  if (!productType) {
    throw new CreationServiceError(`未知的造物类型: ${craftType}`);
  }

  const selectedMaterials = await loadOwnedMaterials(cultivatorId, materialIds);
  const validation = buildCreationPreviewValidation(
    productType,
    toCreationMaterials(selectedMaterials),
  );

  return {
    productType,
    materials: selectedMaterials,
    validation,
  };
}

/**
 * 主造物入口（炼器/神通/功法）。
 * 对应旧 CreationEngine.processRequest，但完全使用 v2 引擎和 creation_products 表。
 */
export async function processCreation(
  cultivatorId: string,
  materialIds: string[],
  craftType: string,
  options: ProcessCreationOptions = {},
): Promise<CreationV2Result> {
  const productType = getCreationProductTypeFromCraftType(craftType);
  if (!productType) {
    throw new CreationServiceError(`未知的造物类型: ${craftType}`);
  }

  const { materialQuantities, userPrompt, requestedSlot, requestedTargetPolicy } = options;

  // Slot 只对 artifact 生效，其它产物传了也忽略，避免下游歧义。
  const effectiveRequestedSlot =
    productType === 'artifact' ? requestedSlot : undefined;

  // TargetPolicy 只对 skill 生效。
  const effectiveRequestedTargetPolicy =
    productType === 'skill' ? requestedTargetPolicy : undefined;

  // 1. Redis 分布式锁
  const lockKey = `craft:lock:${cultivatorId}`;
  const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: 30 });
  if (!acquired) {
    throw new CreationServiceError('炉火正旺，道友莫急', 429);
  }

  try {
    // 2. 加载并校验材料归属
    const selectedMaterials = await loadOwnedMaterials(cultivatorId, materialIds);

    // 3. 加载角色（用于资源校验和容量检查）
    const [cultivator] = await getExecutor()
      .select()
      .from(cultivators)
      .where(eq(cultivators.id, cultivatorId))
      .limit(1);

    if (!cultivator) {
      throw new CreationServiceError('道友查无此人', 404);
    }

    const fullCultivator = await getCultivatorByIdUnsafe(cultivatorId);
    const fateCreationContext = FateEngine.evaluateCreationContext(
      fullCultivator?.cultivator.pre_heaven_fates ?? [],
    );
    const enrichedUserPrompt = [
      userPrompt?.trim(),
      fateCreationContext.summary
        ? `命格偏置：${fateCreationContext.summary}`
        : undefined,
    ]
      .filter(Boolean)
      .join('；');

    // 4. 计算资源消耗
    const maxQuality = calculateMaxQuality(
      selectedMaterials as unknown as Array<{ rank: Quality }>,
    );
    const resourceType =
      productType === 'artifact' ? 'spiritStone' : 'comprehension';
    const costAmount = calculateCraftCost(maxQuality, resourceType);

    // 校验资源是否充足
    if (resourceType === 'spiritStone') {
      if ((cultivator.spirit_stones ?? 0) < costAmount) {
        throw new CreationServiceError(`灵石不足，需要 ${costAmount} 枚`);
      }
    } else {
      const progress = cultivator.cultivation_progress as {
        comprehension_insight?: number;
      } | null;
      if ((progress?.comprehension_insight ?? 0) < costAmount) {
        throw new CreationServiceError(`道心感悟不足，需要 ${costAmount} 点`);
      }
    }

    // 5. 计算每种材料本次“实际投入数量”（dose）。
    //
    // 来源：前端传入的 materialQuantities（可选，每个 id 映射 1..3 的整数）。
    // 规则：
    //   - 未传视为 1；
    //   - 被夹紧到 [minQuantityPerMaterial, maxQuantityPerMaterial]（V2 引擎硬约束）；
    //   - 不能超过仓库现存库存。
    //
    // 这里把 DB 行里的 quantity（仓库库存）换成 dose 再交给 orchestrator，
    // 既避免 CreationInputValidator 因库存 > 3 报 400，也允许玩家自由决定
    // 本次投入多少份，以影响 energyValue/dominantTags 等后续计算。
    const { minQuantityPerMaterial, maxQuantityPerMaterial } =
      CREATION_INPUT_CONSTRAINTS;

    const dosePerMaterial = new Map<string, number>();
    for (const material of selectedMaterials) {
      const requested = materialQuantities?.[material.id] ?? 1;
      if (!Number.isFinite(requested)) {
        throw new CreationServiceError(
          `材料「${material.name}」投入数量非法：${requested}`,
        );
      }

      const clamped = Math.min(
        maxQuantityPerMaterial,
        Math.max(minQuantityPerMaterial, Math.floor(requested)),
      );
      if (clamped > (material.quantity ?? 0)) {
        throw new CreationServiceError(
          `材料「${material.name}」库存不足：需要 ${clamped}，仅剩 ${material.quantity ?? 0}`,
        );
      }
      dosePerMaterial.set(material.id, clamped);
    }

    const engineMaterials = toCreationMaterials(selectedMaterials, dosePerMaterial);

    const session = await orchestrator.craftAsync({
      cultivatorId,
      creatorName: cultivator.name,
      realm: cultivator.realm as RealmType,
      realmStage: cultivator.realm_stage as RealmStage,
      productType,
      materials: engineMaterials,
      ...(fateCreationContext.dominantTags.length > 0
        ? { contextDominantTags: fateCreationContext.dominantTags }
        : {}),
      ...(enrichedUserPrompt ? { userPrompt: enrichedUserPrompt } : {}),
      ...(effectiveRequestedSlot
        ? { requestedSlot: effectiveRequestedSlot }
        : {}),
      ...(effectiveRequestedTargetPolicy
        ? { requestedTargetPolicy: effectiveRequestedTargetPolicy }
        : {}),
    });

    const outcome = session.state.outcome;
    if (!outcome) {
      const failure = session.state.failureReason;
      throw new CreationServiceError(failure ?? '造物失败，请检查材料组合');
    }

    // 6. 映射为 DB 行
    const row = toRow(outcome, cultivatorId);

    // 7. 事务：扣资源 + 消耗材料 + 写入/暂存产物
    let insertedId: string | null = null;
    let needsReplace = false;
    let currentCount = 0;
    let maxCount = 0;

    await getExecutor().transaction(async (tx) => {
      // 7.1 扣除资源
      if (resourceType === 'spiritStone') {
        await tx
          .update(cultivators)
          .set({
            spirit_stones: sql`${cultivators.spirit_stones} - ${costAmount}`,
          })
          .where(eq(cultivators.id, cultivatorId));
      } else {
        await tx
          .update(cultivators)
          .set({
            cultivation_progress: sql`jsonb_set(
              COALESCE(${cultivators.cultivation_progress}, '{}'),
              '{comprehension_insight}',
              to_jsonb(GREATEST(0, COALESCE((${cultivators.cultivation_progress}->>'comprehension_insight')::int, 0) - ${costAmount}))
            )`,
          })
          .where(eq(cultivators.id, cultivatorId));
      }

      for (const material of selectedMaterials) {
        const dose = dosePerMaterial.get(material.id) ?? 1;
        const stock = material.quantity ?? 0;
        if (stock > dose) {
          await tx
            .update(materials)
            .set({ quantity: sql`${materials.quantity} - ${dose}` })
            .where(eq(materials.id, material.id));
        } else {
          await tx.delete(materials).where(eq(materials.id, material.id));
        }
      }

      if (productType === 'skill') {
        currentCount = await creationProductRepository.countByType(
          cultivatorId,
          'skill',
          tx,
        );
        maxCount = cultivator.max_skills ?? 3;
        if (currentCount >= maxCount) needsReplace = true;
      } else if (productType === 'gongfa') {
        currentCount = await creationProductRepository.countByType(
          cultivatorId,
          'gongfa',
          tx,
        );
        maxCount = MAX_GONGFA;
        if (currentCount >= maxCount) needsReplace = true;
      }

      if (needsReplace) {
        // 暂存到 Redis，等待用户替换确认
        const snapshot = snapshotCraftedOutcome(outcome);
        const pendingPayload = JSON.stringify({
          snapshot: serializeCraftedOutcomeSnapshot(snapshot),
          previewName: row.name,
          previewQuality: row.quality ?? null,
          previewElement: row.element ?? null,
        });
        const pendingKey = `creation_pending_v2:${cultivatorId}:${craftType}`;
        await redis.set(pendingKey, pendingPayload, { ex: 3600 });
      } else {
        // 直接写入
        const record = await creationProductRepository.insert(row, tx);
        insertedId = record.id;
      }
    });

    if (needsReplace) {
      // 返回"需要替换"标识，不含 id
      return {
        id: '',
        productType,
        name: row.name,
        description: row.description ?? null,
        element: row.element ?? null,
        quality: row.quality ?? null,
        slot: row.slot ?? null,
        score: row.score ?? 0,
        affixes: extractAffixSummary(outcome.blueprint.productModel.affixes),
        needs_replace: true,
        currentCount,
        maxCount,
      };
    }

    return {
      id: insertedId!,
      productType,
      name: row.name,
      description: row.description ?? null,
      element: row.element ?? null,
      quality: row.quality ?? null,
      slot: row.slot ?? null,
      score: row.score ?? 0,
      affixes: extractAffixSummary(outcome.blueprint.productModel.affixes),
    };
  } finally {
    await redis.del(lockKey);
  }
}

/**
 * 获取 Redis 暂存的待替换产物预览信息。
 */
export async function getPendingCreation(
  cultivatorId: string,
  craftType: string,
): Promise<PendingCreationItem | null> {
  const pendingKey = `creation_pending_v2:${cultivatorId}:${craftType}`;
  const raw = await redis.get<string>(pendingKey);
  if (!raw) return null;

  const payload = JSON.parse(raw) as {
    snapshot: string;
    previewName: string;
    previewQuality: string | null;
    previewElement: string | null;
  };
  const productType = getCreationProductTypeFromCraftType(craftType);
  if (!productType) {
    throw new CreationServiceError(`未知的造物类型: ${craftType}`);
  }

  return {
    snapshot: payload.snapshot,
    productType,
    previewName: payload.previewName,
    previewElement: payload.previewElement,
    previewQuality: payload.previewQuality,
  };
}

/**
 * 确认替换：将 Redis 暂存的产物写入 DB，可选先删除一条旧产物。
 */
export async function confirmCreation(
  cultivatorId: string,
  craftType: string,
  replaceId: string | null,
): Promise<CreationV2Result> {
  const pendingKey = `creation_pending_v2:${cultivatorId}:${craftType}`;
  const raw = await redis.get<string>(pendingKey);
  if (!raw) {
    throw new CreationServiceError('未找到待确认的造物结果，可能已过期', 404);
  }

  const payload = JSON.parse(raw) as { snapshot: string };
  const snapshot = deserializeCraftedOutcomeSnapshot(payload.snapshot);
  const outcome = restoreCraftedOutcome(snapshot, new CreationAbilityAdapter());
  const row = toRow(outcome, cultivatorId);

  let insertedId!: string;
  await getExecutor().transaction(async (tx) => {
    if (replaceId) {
      // 验证被替换产物归属
      const existing = await creationProductRepository.findById(replaceId, tx);
      if (!existing || existing.cultivatorId !== cultivatorId) {
        throw new CreationServiceError('目标产物不存在或不属于你', 403);
      }
      await creationProductRepository.deleteById(replaceId, tx);
    }

    const record = await creationProductRepository.insert(row, tx);
    insertedId = record.id;
  });

  await redis.del(pendingKey);

  return {
    id: insertedId,
    productType: row.productType as CreationProductType,
    name: row.name,
    description: row.description ?? null,
    element: row.element ?? null,
    quality: row.quality ?? null,
    slot: row.slot ?? null,
    score: row.score ?? 0,
    affixes: extractAffixSummary(outcome.blueprint.productModel.affixes),
  };
}

/**
 * 放弃 Redis 暂存的待替换产物。
 */
export async function abandonPending(
  cultivatorId: string,
  craftType: string,
): Promise<void> {
  const pendingKey = `creation_pending_v2:${cultivatorId}:${craftType}`;
  await redis.del(pendingKey);
}

/**
 * 从 RolledAffix[] 中提取前端结果页需要的摘要信息。
 */
function extractAffixSummary(
  affixes: Array<{
    id: string;
    name: string;
    category: string;
    isPerfect: boolean;
    rollEfficiency: number;
  }>,
) {
  return affixes.map((affix) => ({
    id: affix.id,
    name: affix.name,
    category: affix.category,
    isPerfect: affix.isPerfect,
    rollEfficiency: affix.rollEfficiency,
  }));
}

/** 造物消耗预估（供 GET /api/craft 使用） */
export function estimateCost(
  selectedMaterials: Array<{ rank: Quality }>,
  craftType: string,
): { spiritStones?: number; comprehension?: number } {
  const productType = getCreationProductTypeFromCraftType(craftType);
  if (!productType) return {};

  const maxQuality = calculateMaxQuality(selectedMaterials);
  if (productType === 'artifact') {
    return { spiritStones: calculateCraftCost(maxQuality, 'spiritStone') };
  }

  return { comprehension: calculateCraftCost(maxQuality, 'comprehension') };
}
