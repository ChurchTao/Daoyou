import { calculateCraftCost, calculateHighestMaterialRank } from '@shared/engine/creation-v2/CraftCostCalculator';
import { getExecutor } from '@server/lib/drizzle/db';
import { consumables, cultivators, materials } from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import type {
  ConditionOperation,
  PillFamily,
  PillSpec,
} from '@shared/types/consumable';
import { calculateSingleElixirScore } from '@server/utils/rankingUtils';
import type { ElementType, Quality } from '@shared/types/constants';
import type { Consumable } from '@shared/types/cultivator';
import { and, eq, inArray } from 'drizzle-orm';
import { addConsumableToInventory } from './cultivatorService';
import { serializeConsumableSpec } from './consumablePersistence';

export class AlchemyServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = 'AlchemyServiceError';
  }
}

type LegacyAlchemyIntent =
  | 'marrow_wash'
  | 'breakthrough'
  | 'tempering'
  | 'healing'
  | 'mana'
  | 'detox'
  | 'hybrid';

function inferAlchemyIntent(prompt: string): LegacyAlchemyIntent {
  if (/洗髓|易筋|伐脉/u.test(prompt)) return 'marrow_wash';
  if (/破境|冲关|破关|化婴|结丹/u.test(prompt)) return 'breakthrough';
  if (/增修|修为|聚气|养气|凝气|淬体|锻骨|强筋|补天/u.test(prompt)) {
    return 'tempering';
  }
  if (/疗伤|回春|续命|生肌/u.test(prompt)) return 'healing';
  if (/回元|回气|回灵|复元/u.test(prompt)) return 'mana';
  if (/解毒|祛毒|清毒/u.test(prompt)) return 'detox';
  return 'hybrid';
}

function inferElementLabel(elements: string[]): string {
  const counts = new Map<string, number>();
  for (const element of elements) {
    counts.set(element, (counts.get(element) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? '灵';
}

function getQualityScalar(quality: Quality): number {
  const scalar = 1 + (['凡品', '灵品', '玄品', '真品', '地品', '天品', '仙品', '神品'].indexOf(quality) * 0.22);
  return scalar;
}

function buildOperations(
  intent: LegacyAlchemyIntent,
  quality: Quality,
): ConditionOperation[] {
  const scalar = getQualityScalar(quality);

  switch (intent) {
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
          track: 'tempering.vitality',
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

function buildConsumableName(
  family: PillFamily,
  element: string,
): string {
  const prefixMap: Record<string, string> = {
    金: '庚金',
    木: '青木',
    水: '玄水',
    火: '炎阳',
    土: '厚土',
    风: '罡风',
    雷: '惊雷',
    冰: '寒霜',
    灵: '玄灵',
  };

  const categoryMap: Record<PillFamily, string> = {
    healing: '疗伤丹',
    mana: '回元丹',
    breakthrough: '破境丹',
    tempering: '淬体丹',
    marrow_wash: '洗髓丹',
    detox: '解毒丹',
    hybrid: '和元丹',
  };

  return `${prefixMap[element] ?? prefixMap.灵}${categoryMap[family]}`;
}

function resolveFamily(intent: LegacyAlchemyIntent): PillFamily {
  switch (intent) {
    case 'breakthrough':
      return 'breakthrough';
    case 'tempering':
      return 'tempering';
    case 'marrow_wash':
      return 'marrow_wash';
    case 'mana':
      return 'mana';
    case 'detox':
      return 'detox';
    case 'hybrid':
      return 'hybrid';
    case 'healing':
    default:
      return 'healing';
  }
}

function countsTowardsQuota(family: PillFamily): boolean {
  return family === 'breakthrough' || family === 'tempering' || family === 'marrow_wash';
}

async function loadOwnedMaterials(cultivatorId: string, materialIds: string[]) {
  const rows = await getExecutor()
    .select()
    .from(materials)
    .where(inArray(materials.id, materialIds));

  if (rows.length !== materialIds.length) {
    throw new AlchemyServiceError('部分材料已耗尽或不存在');
  }

  for (const row of rows) {
    if (row.cultivatorId !== cultivatorId) {
      throw new AlchemyServiceError('非本人材料，不可动用', 403);
    }
  }

  return rows;
}

export async function previewAlchemySelection(
  cultivatorId: string,
  materialIds: string[],
): Promise<{
  materials: Array<typeof materials.$inferSelect>;
}> {
  return {
    materials: await loadOwnedMaterials(cultivatorId, materialIds),
  };
}

export async function processAlchemyCraft(
  cultivatorId: string,
  materialIds: string[],
  options: {
    materialQuantities?: Record<string, number>;
    userPrompt?: string;
  } = {},
): Promise<{
  id?: string;
  name: string;
  quality: Quality;
  family: PillFamily;
}> {
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

    const highestMaterialRank = calculateHighestMaterialRank(
      selectedMaterials as unknown as Array<{ rank: Quality }>,
    );
    const cost = calculateCraftCost(highestMaterialRank, 'spiritStone');

    if ((cultivator.spirit_stones ?? 0) < cost) {
      throw new AlchemyServiceError(`灵石不足，需要 ${cost} 枚`);
    }

    const prompt = options.userPrompt?.trim();
    if (!prompt) {
      throw new AlchemyServiceError('请注入神念，描述丹药功效。');
    }

    const intent = inferAlchemyIntent(prompt);
    const family = resolveFamily(intent);
    const element = inferElementLabel(
      selectedMaterials
        .map((material) => material.element)
        .filter((value): value is string => Boolean(value)),
    );
    const spec: PillSpec = {
      kind: 'pill',
      family,
      operations: buildOperations(intent, highestMaterialRank),
      consumeRules: {
        scene: 'out_of_battle_only',
        countsTowardLongTermQuota: countsTowardsQuota(family),
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: selectedMaterials.map((material) => material.name),
        dominantElement: element === '灵' ? undefined : (element as ElementType),
        stability: 55,
        toxicityRating: 20,
        tags: [intent],
      },
    };
    const consumable: Consumable = {
      name: buildConsumableName(family, element),
      type: '丹药',
      quality: highestMaterialRank,
      quantity: 1,
      prompt,
      description: `以${selectedMaterials.map((material) => material.name).join('、')}熔炼而成，药性偏向「${prompt}」。`,
      spec,
    };
    consumable.score = calculateSingleElixirScore(consumable);

    await getExecutor().transaction(async (tx) => {
      for (const material of selectedMaterials) {
        const dose = Math.max(
          1,
          Math.min(
            material.quantity,
            Math.floor(options.materialQuantities?.[material.id] ?? 1),
          ),
        );

        if (dose >= material.quantity) {
          await tx.delete(materials).where(eq(materials.id, material.id));
        } else {
          await tx
            .update(materials)
            .set({ quantity: material.quantity - dose })
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
      (row) => serializeConsumableSpec(row.spec as Consumable['spec']) === serializeConsumableSpec(spec),
    );

    return {
      id: insertedRow?.id,
      name: consumable.name,
      quality: highestMaterialRank,
      family,
    };
  } finally {
    await redis.del(lockKey);
  }
}
