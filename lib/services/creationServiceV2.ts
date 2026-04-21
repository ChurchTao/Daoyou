import { CreationOrchestrator } from '@/engine/creation-v2/CreationOrchestrator';
import { CreationAbilityAdapter } from '@/engine/creation-v2/adapters/CreationAbilityAdapter';
import {
  deserializeCraftedOutcomeSnapshot,
  restoreCraftedOutcome,
  serializeCraftedOutcomeSnapshot,
  snapshotCraftedOutcome,
} from '@/engine/creation-v2/persistence/OutcomeSnapshot';
import { toRow } from '@/engine/creation-v2/persistence/ProductPersistenceMapper';
import type { CreationProductType } from '@/engine/creation-v2/types';
import {
  calculateCraftCost,
  calculateMaxQuality,
} from '@/engine/creation-v2/CraftCostCalculator';
import { getExecutor } from '@/lib/drizzle/db';
import { cultivators, materials } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import * as creationProductRepository from '@/lib/repositories/creationProductRepository';
import { CREATION_INPUT_CONSTRAINTS } from '@/engine/creation-v2/config/CreationBalance';
import type { EquipmentSlot, Quality } from '@/types/constants';
import type { Material } from '@/types/cultivator';
import { eq, inArray, sql } from 'drizzle-orm';

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
}

/** craftType 字符串 → CreationProductType 映射 */
const CRAFT_TYPE_MAP: Record<string, CreationProductType> = {
  refine: 'artifact',
  create_skill: 'skill',
  create_gongfa: 'gongfa',
};

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
  snapshot: string; // 序列化的 CraftedOutcomeSnapshot
  productType: CreationProductType;
  previewName: string;
  previewElement: string | null;
  previewQuality: string | null;
}

const orchestrator = new CreationOrchestrator();

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
  const productType = CRAFT_TYPE_MAP[craftType];
  if (!productType) {
    throw new CreationServiceError(`未知的造物类型: ${craftType}`);
  }

  const { materialQuantities, userPrompt, requestedSlot } = options;

  // Slot 只对 artifact 生效，其它产物传了也忽略，避免下游歧义。
  const effectiveRequestedSlot =
    productType === 'artifact' ? requestedSlot : undefined;

  // 1. Redis 分布式锁
  const lockKey = `craft:lock:${cultivatorId}`;
  const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: 30 });
  if (!acquired) {
    throw new CreationServiceError('炉火正旺，道友莫急', 429);
  }

  try {
    // 2. 加载并校验材料归属
    const selectedMaterials = await getExecutor()
      .select()
      .from(materials)
      .where(inArray(materials.id, materialIds));

    if (selectedMaterials.length !== materialIds.length) {
      throw new CreationServiceError('部分材料已耗尽或不存在');
    }
    for (const mat of selectedMaterials) {
      if (mat.cultivatorId !== cultivatorId) {
        throw new CreationServiceError('非本人材料，不可动用', 403);
      }
    }

    // 3. 加载角色（用于资源校验和容量检查）
    const [cultivator] = await getExecutor()
      .select()
      .from(cultivators)
      .where(eq(cultivators.id, cultivatorId))
      .limit(1);

    if (!cultivator) {
      throw new CreationServiceError('道友查无此人', 404);
    }

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
    for (const mat of selectedMaterials) {
      const requested = materialQuantities?.[mat.id] ?? 1;
      if (!Number.isFinite(requested)) {
        throw new CreationServiceError(
          `材料「${mat.name}」投入数量非法：${requested}`,
        );
      }
      const clamped = Math.min(
        maxQuantityPerMaterial,
        Math.max(minQuantityPerMaterial, Math.floor(requested)),
      );
      if (clamped > (mat.quantity ?? 0)) {
        throw new CreationServiceError(
          `材料「${mat.name}」库存不足：需要 ${clamped}，仅剩 ${mat.quantity ?? 0}`,
        );
      }
      dosePerMaterial.set(mat.id, clamped);
    }

    const engineMaterials: Material[] = selectedMaterials.map((mat) => ({
      id: mat.id,
      name: mat.name,
      type: mat.type as Material['type'],
      rank: mat.rank as Quality,
      element: (mat.element ?? undefined) as Material['element'],
      description: mat.description ?? undefined,
      details: (mat.details ?? undefined) as Material['details'],
      quantity: dosePerMaterial.get(mat.id) ?? 1,
    }));

    const session = await orchestrator.craftAsync({
      cultivatorId,
      productType,
      materials: engineMaterials,
      ...(userPrompt?.trim() ? { userPrompt: userPrompt.trim() } : {}),
      ...(effectiveRequestedSlot
        ? { requestedSlot: effectiveRequestedSlot }
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

      // 7.2 消耗材料：按玩家指定的 dose 扣减，归零则删除
      for (const mat of selectedMaterials) {
        const dose = dosePerMaterial.get(mat.id) ?? 1;
        const stock = mat.quantity ?? 0;
        if (stock > dose) {
          await tx
            .update(materials)
            .set({ quantity: sql`${materials.quantity} - ${dose}` })
            .where(eq(materials.id, mat.id));
        } else {
          await tx.delete(materials).where(eq(materials.id, mat.id));
        }
      }

      // 7.3 容量检查
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
  const productType = CRAFT_TYPE_MAP[craftType];

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
  return affixes.map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
    isPerfect: a.isPerfect,
    rollEfficiency: a.rollEfficiency,
  }));
}

/** 造物消耗预估（供 GET /api/craft 使用） */
export function estimateCost(
  selectedMaterials: Array<{ rank: Quality }>,
  craftType: string,
): { spiritStones?: number; comprehension?: number } {
  const productType = CRAFT_TYPE_MAP[craftType];
  if (!productType) return {};

  const maxQuality = calculateMaxQuality(selectedMaterials);
  if (productType === 'artifact') {
    return { spiritStones: calculateCraftCost(maxQuality, 'spiritStone') };
  }
  return { comprehension: calculateCraftCost(maxQuality, 'comprehension') };
}
