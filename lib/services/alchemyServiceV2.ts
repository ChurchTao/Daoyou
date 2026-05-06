import { calculateCraftCost, calculateMaxQuality } from '@/engine/creation-v2/CraftCostCalculator';
import { getExecutor } from '@/lib/drizzle/db';
import { consumables, cultivators, materials } from '@/lib/drizzle/schema';
import { redis } from '@/lib/redis';
import { calculateSingleElixirScore } from '@/utils/rankingUtils';
import type { Quality } from '@/types/constants';
import type { Consumable } from '@/types/cultivator';
import { and, eq, inArray } from 'drizzle-orm';
import { addConsumableToInventory } from './cultivatorService';

export class AlchemyServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = 'AlchemyServiceError';
  }
}

function inferAlchemyCategory(
  prompt: string,
): NonNullable<Consumable['category']> {
  if (/洗髓|易筋|伐脉/u.test(prompt)) return 'marrow_wash';
  if (/破境|冲关|破关|化婴|结丹/u.test(prompt)) return 'breakthrough';
  if (/增修|修为|聚气|养气|凝气/u.test(prompt)) return 'cultivation';
  if (/疗伤|回春|续命|生肌/u.test(prompt)) return 'healing';
  if (/回元|回气|回灵|复元/u.test(prompt)) return 'mana';
  if (/解毒|祛毒|清毒/u.test(prompt)) return 'detox';
  if (/控毒|镇毒|驭毒/u.test(prompt)) return 'poison_control';
  if (/淬体|锻骨|强筋|补天/u.test(prompt)) return 'permanent_attribute';
  return 'healing';
}

function inferElementLabel(elements: string[]): string {
  const counts = new Map<string, number>();
  for (const element of elements) {
    counts.set(element, (counts.get(element) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? '灵';
}

function buildUseSpec(
  category: Consumable['category'],
  quality: Quality,
): NonNullable<Consumable['useSpec']> {
  const scalar = 1 + (['凡品', '灵品', '玄品', '真品', '地品', '天品', '仙品', '神品'].indexOf(quality) * 0.22);

  switch (category) {
    case 'mana':
      return {
        mpRecoverFlat: Math.floor(90 * scalar),
        toxicityDelta: 3,
      };
    case 'cultivation':
      return {
        cultivationExpGain: Math.floor(180 * scalar),
        comprehensionInsightGain: Math.max(1, Math.floor(4 * scalar)),
        toxicityDelta: 9,
      };
    case 'breakthrough':
      return {
        breakthroughChanceBonus: Number((0.025 * scalar).toFixed(3)),
        comprehensionInsightGain: Math.max(2, Math.floor(5 * scalar)),
        toxicityDelta: 12,
      };
    case 'permanent_attribute':
      return {
        attributeDelta: { vitality: Math.max(1, Math.floor(1 * scalar)) },
        toxicityDelta: 10,
      };
    case 'marrow_wash':
      return {
        spiritualRootDelta: {
          mode: 'all',
          amount: Math.max(2, Math.floor(4 * scalar)),
          cap: 100,
        },
        aptitudeDelta: Math.max(1, Math.floor(2 * scalar)),
        toxicityDelta: 14,
      };
    case 'detox':
      return {
        detoxifyAmount: Math.floor(18 * scalar),
        toxicityDelta: -8,
      };
    case 'poison_control':
      return {
        detoxifyAmount: Math.floor(10 * scalar),
        toxicityDelta: -5,
      };
    case 'healing':
    default:
      return {
        hpRecoverFlat: Math.floor(120 * scalar),
        woundRelief: scalar > 1.8 ? 2 : 1,
        toxicityDelta: 4,
      };
  }
}

function buildConsumableName(
  category: Consumable['category'],
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

  const categoryMap: Record<NonNullable<Consumable['category']>, string> = {
    healing: '疗伤丹',
    mana: '回元丹',
    cultivation: '养气丹',
    breakthrough: '破境丹',
    permanent_attribute: '淬体丹',
    marrow_wash: '洗髓丹',
    detox: '解毒丹',
    poison_control: '镇毒丹',
    talisman_key: '灵符',
  };

  return `${prefixMap[element] ?? prefixMap.灵}${categoryMap[category ?? 'healing']}`;
}

function countsTowardsQuota(category: Consumable['category']): boolean {
  return (
    category === 'cultivation' ||
    category === 'breakthrough' ||
    category === 'permanent_attribute' ||
    category === 'marrow_wash'
  );
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
  category: NonNullable<Consumable['category']>;
}> {
  const lockKey = `alchemy:lock:${cultivatorId}`;
  const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: 30 });
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

    const quality = calculateMaxQuality(
      selectedMaterials as unknown as Array<{ rank: Quality }>,
    );
    const cost = calculateCraftCost(quality, 'spiritStone');

    if ((cultivator.spirit_stones ?? 0) < cost) {
      throw new AlchemyServiceError(`灵石不足，需要 ${cost} 枚`);
    }

    const prompt = options.userPrompt?.trim();
    if (!prompt) {
      throw new AlchemyServiceError('请注入神念，描述丹药功效。');
    }

    const category = inferAlchemyCategory(prompt);
    const element = inferElementLabel(
      selectedMaterials
        .map((material) => material.element)
        .filter((value): value is string => Boolean(value)),
    );
    const consumable: Consumable = {
      name: buildConsumableName(category, element),
      type: '丹药',
      quality,
      quantity: 1,
      category,
      quotaKind: countsTowardsQuota(category) ? 'long_term_pill' : undefined,
      mechanicKey: `alchemy_v2.${category}`,
      prompt,
      description: `以${selectedMaterials.map((material) => material.name).join('、')}熔炼而成，药性偏向「${prompt}」。`,
      useSpec: buildUseSpec(category, quality),
      details: {
        craftedBy: 'alchemy_v2',
        sourceMaterials: selectedMaterials.map((material) => material.name),
        dominantElement: element,
      },
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
      .select({ id: consumables.id })
      .from(consumables)
      .where(
        and(
          eq(consumables.cultivatorId, cultivatorId),
          eq(consumables.name, consumable.name),
          eq(consumables.quality, quality),
        ),
      )
      .limit(1);

    return {
      id: inserted[0]?.id,
      name: consumable.name,
      quality,
      category,
    };
  } finally {
    await redis.del(lockKey);
  }
}
