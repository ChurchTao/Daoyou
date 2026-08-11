import { db, type DbTransaction } from '@server/lib/drizzle/db';
import {
  herbGardenInteractions,
  herbGardenPlots,
  herbGardenProfiles,
} from '@server/lib/drizzle/herbGardenSchema';
import {
  cultivatorFriends,
  cultivators,
  materials,
  preHeavenFates,
  sectFacilities,
  sectMemberships,
  spiritualRoots,
} from '@server/lib/drizzle/schema';
import { addMaterialStackToInventory } from '@server/lib/services/materialInventory';
import {
  findHerbDefinition,
  HERB_GARDEN_MAX_GROWTH_REDUCTION,
  HERB_GARDEN_MAX_HELPERS,
  HERB_GARDEN_MAX_STEAL_RATIO,
  HERB_GARDEN_MAX_YIELD_BONUS,
  HERB_GARDEN_PLOT_COUNT,
  HERB_GARDEN_STARTER_SEEDS,
  HERB_SEED_QUALITY_CONFIG,
  isHerbSeedQuality,
  nextHerbQuality,
  type HerbGardenHarvestResult,
  type HerbGardenLogView,
  type HerbGardenModifierLine,
  type HerbGardenSeedMeta,
  type HerbGardenSeedStack,
  type HerbGardenState,
  type HerbSeedQuality,
} from '@shared/contracts/herbGarden';
import type { Quality } from '@shared/types/constants';
import { and, desc, eq, gt, inArray, lte, sql } from 'drizzle-orm';

const GARDEN_FACILITY_KEYS = ['herbGarden', 'herb_garden', 'herb-garden', 'garden'];

export class HerbGardenError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

type JsonObject = Record<string, unknown>;
type FateEffectLike = {
  effectType?: string;
  value?: number;
  polarity?: string;
  label?: string;
};
type ModifierTotals = {
  growthReduction: number;
  yieldBonus: number;
  mutationBonus: number;
  seedReturnBonus: number;
  lines: HerbGardenModifierLine[];
};

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function readSeedMeta(value: unknown): HerbGardenSeedMeta | undefined {
  const details = asObject(value);
  if (
    details?.kind !== 'herb_seed' ||
    typeof details.herbKey !== 'string' ||
    !isHerbSeedQuality(details.seedQuality)
  ) {
    return undefined;
  }
  return {
    kind: 'herb_seed',
    herbKey: details.herbKey,
    seedQuality: details.seedQuality,
  };
}

function parseFateEffects(details: unknown): FateEffectLike[] {
  const effects = asObject(details)?.effects;
  if (!Array.isArray(effects)) return [];
  return effects.flatMap((entry) => {
    const effect = asObject(entry);
    if (!effect) return [];
    return [
      {
        effectType:
          typeof effect.effectType === 'string' ? effect.effectType : undefined,
        value: typeof effect.value === 'number' ? effect.value : undefined,
        polarity: typeof effect.polarity === 'string' ? effect.polarity : undefined,
        label: typeof effect.label === 'string' ? effect.label : undefined,
      },
    ];
  });
}

function seedName(herbName: string, quality: HerbSeedQuality): string {
  return `${herbName}种·${quality}`;
}

function seedMaterial(herbKey: string, seedQuality: HerbSeedQuality) {
  const herb = findHerbDefinition(herbKey);
  if (!herb) throw new HerbGardenError('未知灵植', 400);
  return {
    name: seedName(herb.name, seedQuality),
    type: 'seed' as const,
    rank: herb.rank,
    element: herb.element,
    description: `${herb.name}的${seedQuality}，可在宗门灵药圃播种。`,
    details: {
      kind: 'herb_seed',
      herbKey,
      seedQuality,
    } satisfies HerbGardenSeedMeta,
    quantity: 1,
  };
}

async function ensureGardenInitialized(cultivatorId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(herbGardenProfiles)
      .values({ cultivatorId })
      .onConflictDoNothing()
      .returning({ cultivatorId: herbGardenProfiles.cultivatorId });
    if (!created) return;

    for (const starter of HERB_GARDEN_STARTER_SEEDS) {
      const material = seedMaterial(starter.herbKey, starter.seedQuality);
      await addMaterialStackToInventory(
        cultivatorId,
        { ...material, quantity: starter.quantity },
        tx,
      );
    }
  });
}

async function assertActiveCultivator(cultivatorId: string): Promise<string> {
  const [cultivator] = await db
    .select({ name: cultivators.name })
    .from(cultivators)
    .where(
      and(eq(cultivators.id, cultivatorId), eq(cultivators.status, 'active')),
    )
    .limit(1);
  if (!cultivator) throw new HerbGardenError('道友不存在或已无法访问', 404);
  return cultivator.name;
}

async function assertFriend(viewerId: string, ownerId: string): Promise<void> {
  if (viewerId === ownerId) return;
  const [friend] = await db
    .select({ id: cultivatorFriends.id })
    .from(cultivatorFriends)
    .where(
      and(
        eq(cultivatorFriends.cultivatorId, viewerId),
        eq(cultivatorFriends.friendCultivatorId, ownerId),
      ),
    )
    .limit(1);
  if (!friend) throw new HerbGardenError('只有好友才能持访客令进入此药田', 403);
}

async function getGardenLevel(cultivatorId: string): Promise<number> {
  const [membership] = await db
    .select({ sectId: sectMemberships.sectId })
    .from(sectMemberships)
    .where(
      and(
        eq(sectMemberships.cultivatorId, cultivatorId),
        eq(sectMemberships.status, 'active'),
      ),
    )
    .limit(1);
  if (!membership) return 1;

  const facilities = await db
    .select({ level: sectFacilities.level })
    .from(sectFacilities)
    .where(
      and(
        eq(sectFacilities.sectId, membership.sectId),
        inArray(sectFacilities.facilityKey, GARDEN_FACILITY_KEYS),
      ),
    );
  return Math.max(1, ...facilities.map((facility) => facility.level));
}

function applyFateEffect(
  totals: ModifierTotals,
  fateName: string,
  fateQuality: string | null,
  effect: FateEffectLike,
): void {
  if (effect.polarity === 'burden' || typeof effect.value !== 'number') return;
  let applied = false;

  if (effect.effectType === 'herb_growth_time_multiplier' && effect.value < 1) {
    totals.growthReduction += 1 - effect.value;
    applied = true;
  } else if (effect.effectType === 'herb_yield_multiplier' && effect.value > 1) {
    totals.yieldBonus += effect.value - 1;
    applied = true;
  } else if (effect.effectType === 'herb_mutation_bonus' && effect.value > 0) {
    totals.mutationBonus += effect.value;
    applied = true;
  } else if (effect.effectType === 'herb_seed_return_bonus' && effect.value > 0) {
    totals.seedReturnBonus += effect.value;
    applied = true;
  } else if (
    effect.effectType === 'natural_recovery_multiplier' &&
    effect.value > 1
  ) {
    totals.growthReduction += Math.min(0.04, (effect.value - 1) * 0.25);
    applied = true;
  } else if (
    effect.effectType === 'toxicity_penalty_multiplier' &&
    effect.value < 1
  ) {
    totals.mutationBonus += Math.min(0.003, (1 - effect.value) * 0.02);
    applied = true;
  } else if (
    effect.effectType === 'alchemy_spirit_stone_multiplier' &&
    effect.value < 1
  ) {
    totals.seedReturnBonus += Math.min(0.04, (1 - effect.value) * 0.25);
    applied = true;
  }

  if (applied) {
    totals.lines.push({
      source: 'fate',
      label: fateName,
      detail:
        effect.label ?? `${fateQuality ?? '凡品'}命格与草木药性产生共鸣。`,
    });
  }
}

async function resolveModifiers(
  cultivatorId: string,
  herbKey: string,
  seedQuality: HerbSeedQuality,
): Promise<{ totals: ModifierTotals; gardenLevel: number }> {
  const herb = findHerbDefinition(herbKey);
  if (!herb) throw new HerbGardenError('未知灵植', 400);

  const [roots, fates, gardenLevel] = await Promise.all([
    db
      .select({
        element: spiritualRoots.element,
        strength: spiritualRoots.strength,
      })
      .from(spiritualRoots)
      .where(eq(spiritualRoots.cultivatorId, cultivatorId)),
    db
      .select({
        name: preHeavenFates.name,
        quality: preHeavenFates.quality,
        details: preHeavenFates.details,
      })
      .from(preHeavenFates)
      .where(eq(preHeavenFates.cultivatorId, cultivatorId)),
    getGardenLevel(cultivatorId),
  ]);

  const totals: ModifierTotals = {
    growthReduction: 0,
    yieldBonus: 0,
    mutationBonus: 0,
    seedReturnBonus: 0,
    lines: [],
  };
  const seedConfig = HERB_SEED_QUALITY_CONFIG[seedQuality];
  totals.growthReduction += seedConfig.growthReduction;
  totals.yieldBonus += seedConfig.yieldBonus;
  totals.mutationBonus += seedConfig.mutationBonus;
  totals.seedReturnBonus += seedConfig.seedReturnBonus;
  if (seedQuality !== '普通种') {
    totals.lines.push({
      source: 'seed',
      label: seedQuality,
      detail: '更好的种质使本轮生长更稳，并略增灵变与留种机会。',
    });
  }

  const matchingRoot = roots
    .filter((root) => root.element === herb.element)
    .sort((a, b) => b.strength - a.strength)[0];
  if (matchingRoot) {
    const strength = clamp(matchingRoot.strength / 100, 0, 1);
    const growth = 0.08 * strength;
    const mutation = 0.005 * strength;
    totals.growthReduction += growth;
    totals.mutationBonus += mutation;
    totals.lines.push({
      source: 'root',
      label: `${herb.element}灵根契合`,
      detail: `灵根强度 ${matchingRoot.strength}，生长加速 ${(growth * 100).toFixed(1)}%，灵变 +${(mutation * 100).toFixed(2)}%。`,
    });
  }

  for (const fate of fates) {
    for (const effect of parseFateEffects(fate.details)) {
      applyFateEffect(totals, fate.name, fate.quality, effect);
    }
  }

  const sectGrowth = Math.min(0.08, Math.max(0, gardenLevel - 1) * 0.02);
  const sectMutation = Math.min(
    0.002,
    Math.max(0, gardenLevel - 1) * 0.0005,
  );
  totals.growthReduction += sectGrowth;
  totals.mutationBonus += sectMutation;
  if (gardenLevel > 1) {
    totals.lines.push({
      source: 'sect',
      label: `宗门药圃 Lv.${gardenLevel}`,
      detail: `宗门设施提供生长加速 ${(sectGrowth * 100).toFixed(0)}%，并改善灵变环境。`,
    });
  }

  totals.growthReduction = clamp(
    totals.growthReduction,
    0,
    HERB_GARDEN_MAX_GROWTH_REDUCTION,
  );
  totals.yieldBonus = clamp(
    totals.yieldBonus,
    0,
    HERB_GARDEN_MAX_YIELD_BONUS,
  );
  totals.mutationBonus = clamp(totals.mutationBonus, 0, 0.08);
  totals.seedReturnBonus = clamp(totals.seedReturnBonus, 0, 0.35);
  return { totals, gardenLevel };
}

async function listSeedStacks(
  cultivatorId: string,
): Promise<HerbGardenSeedStack[]> {
  const rows = await db
    .select({
      id: materials.id,
      name: materials.name,
      details: materials.details,
      quantity: materials.quantity,
    })
    .from(materials)
    .where(
      and(
        eq(materials.cultivatorId, cultivatorId),
        eq(materials.type, 'seed'),
        gt(materials.quantity, 0),
      ),
    );

  return rows.flatMap((row) => {
    const meta = readSeedMeta(row.details);
    if (!meta) return [];
    const herb = findHerbDefinition(meta.herbKey);
    if (!herb) return [];
    return [
      {
        materialId: row.id,
        name: row.name,
        herbKey: herb.key,
        herbName: herb.name,
        herbRank: herb.rank,
        element: herb.element,
        seedQuality: meta.seedQuality,
        quantity: row.quantity,
        minGardenLevel: herb.minGardenLevel,
      },
    ];
  });
}

async function consumeSeed(
  cultivatorId: string,
  materialId: string,
  tx: DbTransaction,
): Promise<HerbGardenSeedMeta> {
  const [seed] = await tx
    .select({ details: materials.details })
    .from(materials)
    .where(
      and(
        eq(materials.id, materialId),
        eq(materials.cultivatorId, cultivatorId),
        eq(materials.type, 'seed'),
        gt(materials.quantity, 0),
      ),
    )
    .limit(1);
  const meta = readSeedMeta(seed?.details);
  if (!meta) throw new HerbGardenError('这不是可播种的灵种', 400);

  const [updated] = await tx
    .update(materials)
    .set({ quantity: sql`${materials.quantity} - 1` })
    .where(
      and(
        eq(materials.id, materialId),
        eq(materials.cultivatorId, cultivatorId),
        eq(materials.type, 'seed'),
        gt(materials.quantity, 0),
      ),
    )
    .returning({ quantity: materials.quantity });
  if (!updated) throw new HerbGardenError('灵种数量不足', 409);
  if (updated.quantity <= 0) {
    await tx.delete(materials).where(eq(materials.id, materialId));
  }
  return meta;
}

export async function plantHerb(
  cultivatorId: string,
  input: { slot: number; seedMaterialId: string },
): Promise<void> {
  if (
    !Number.isInteger(input.slot) ||
    input.slot < 1 ||
    input.slot > HERB_GARDEN_PLOT_COUNT
  ) {
    throw new HerbGardenError('灵畦编号无效', 400);
  }
  await ensureGardenInitialized(cultivatorId);

  const [seedRow] = await db
    .select({ details: materials.details })
    .from(materials)
    .where(
      and(
        eq(materials.id, input.seedMaterialId),
        eq(materials.cultivatorId, cultivatorId),
        eq(materials.type, 'seed'),
        gt(materials.quantity, 0),
      ),
    )
    .limit(1);
  const preview = readSeedMeta(seedRow?.details);
  if (!preview) throw new HerbGardenError('找不到可用灵种', 404);
  const herb = findHerbDefinition(preview.herbKey);
  if (!herb) throw new HerbGardenError('灵种记载已经失效', 400);

  const { totals, gardenLevel } = await resolveModifiers(
    cultivatorId,
    herb.key,
    preview.seedQuality,
  );
  if (gardenLevel < herb.minGardenLevel) {
    throw new HerbGardenError(
      `宗门药圃需达到 Lv.${herb.minGardenLevel} 才能稳定培育${herb.name}`,
      403,
    );
  }

  const growthMinutes = Math.max(
    5,
    Math.round(herb.growthMinutes * (1 - totals.growthReduction)),
  );
  const finalYield = Math.max(
    1,
    Math.round(herb.baseYield * (1 + totals.yieldBonus)),
  );
  const mutationChance = round4(
    clamp(herb.mutationChance + totals.mutationBonus, 0, 0.12),
  );
  const seedReturnChance = round4(
    clamp(herb.seedReturnChance + totals.seedReturnBonus, 0, 0.8),
  );
  const mutationRank =
    Math.random() < mutationChance ? nextHerbQuality(herb.rank) : null;
  const stealLimit = Math.min(
    Math.floor(finalYield * HERB_GARDEN_MAX_STEAL_RATIO),
    Math.max(0, finalYield - 1),
  );
  const plantedAt = new Date();
  const readyAt = new Date(plantedAt.getTime() + growthMinutes * 60_000);

  await db.transaction(async (tx) => {
    const [occupied] = await tx
      .select({ id: herbGardenPlots.id })
      .from(herbGardenPlots)
      .where(
        and(
          eq(herbGardenPlots.cultivatorId, cultivatorId),
          eq(herbGardenPlots.slot, input.slot),
        ),
      )
      .limit(1);
    if (occupied) throw new HerbGardenError('这块灵畦已有灵植', 409);

    const consumed = await consumeSeed(
      cultivatorId,
      input.seedMaterialId,
      tx,
    );
    if (
      consumed.herbKey !== preview.herbKey ||
      consumed.seedQuality !== preview.seedQuality
    ) {
      throw new HerbGardenError('灵种状态已经变化，请重新选择', 409);
    }

    const [plot] = await tx
      .insert(herbGardenPlots)
      .values({
        cultivatorId,
        slot: input.slot,
        herbKey: herb.key,
        seedQuality: consumed.seedQuality,
        plantedAt,
        readyAt,
        baseYield: finalYield,
        remainingYield: finalYield,
        stealLimit,
        stolenCount: 0,
        mutationChance,
        mutationRank,
        seedReturnChance,
        modifierSnapshot: totals.lines,
      })
      .returning({ id: herbGardenPlots.id });

    await tx.insert(herbGardenInteractions).values({
      plotId: plot.id,
      ownerId: cultivatorId,
      actorId: cultivatorId,
      action: 'plant',
      herbKey: herb.key,
      payload: { slot: input.slot, seedQuality: consumed.seedQuality },
    });
  });
}

export async function harvestHerb(
  cultivatorId: string,
  plotId: string,
): Promise<HerbGardenHarvestResult> {
  await ensureGardenInitialized(cultivatorId);
  return db.transaction(async (tx) => {
    const [plot] = await tx
      .delete(herbGardenPlots)
      .where(
        and(
          eq(herbGardenPlots.id, plotId),
          eq(herbGardenPlots.cultivatorId, cultivatorId),
          lte(herbGardenPlots.readyAt, new Date()),
          gt(herbGardenPlots.remainingYield, 0),
        ),
      )
      .returning();
    if (!plot) {
      throw new HerbGardenError('灵植尚未成熟，或已经被收获', 409);
    }

    const herb = findHerbDefinition(plot.herbKey);
    if (!herb) throw new HerbGardenError('灵植记载失效', 500);
    const mutationRank = plot.mutationRank as Quality | null;
    const hasMutation = Boolean(
      mutationRank && mutationRank !== herb.rank && plot.remainingYield > 0,
    );
    const normalQuantity = Math.max(
      0,
      plot.remainingYield - (hasMutation ? 1 : 0),
    );

    if (normalQuantity > 0) {
      await addMaterialStackToInventory(
        cultivatorId,
        {
          name: herb.name,
          type: 'herb',
          rank: herb.rank,
          element: herb.element,
          description: herb.description,
          details: { source: 'herb_garden' },
          quantity: normalQuantity,
        },
        tx,
      );
    }

    let mutation: HerbGardenHarvestResult['mutation'];
    if (hasMutation && mutationRank) {
      const mutationName = `${herb.name}·灵变`;
      await addMaterialStackToInventory(
        cultivatorId,
        {
          name: mutationName,
          type: 'herb',
          rank: mutationRank,
          element: herb.element,
          description: `${herb.name}在药田中偶得灵机而成，药性更为凝练。`,
          details: { source: 'herb_garden', mutationOf: herb.key },
          quantity: 1,
        },
        tx,
      );
      mutation = { name: mutationName, rank: mutationRank, quantity: 1 };
    }

    let returnedSeed: HerbGardenHarvestResult['returnedSeed'];
    const quality = isHerbSeedQuality(plot.seedQuality)
      ? plot.seedQuality
      : '普通种';
    if (Math.random() < plot.seedReturnChance) {
      const seed = seedMaterial(herb.key, quality);
      await addMaterialStackToInventory(cultivatorId, seed, tx);
      returnedSeed = { name: seed.name, seedQuality: quality, quantity: 1 };
    }

    await tx
      .update(herbGardenProfiles)
      .set({ totalHarvests: sql`${herbGardenProfiles.totalHarvests} + 1` })
      .where(eq(herbGardenProfiles.cultivatorId, cultivatorId));
    await tx.insert(herbGardenInteractions).values({
      plotId: plot.id,
      ownerId: cultivatorId,
      actorId: cultivatorId,
      action: 'harvest',
      herbKey: herb.key,
      payload: {
        quantity: plot.remainingYield,
        mutationRank: mutation?.rank ?? null,
        returnedSeed: Boolean(returnedSeed),
      },
    });

    return {
      herbName: herb.name,
      rank: herb.rank,
      quantity: normalQuantity,
      mutation,
      returnedSeed,
    };
  });
}

export async function harvestAllReadyHerbs(
  cultivatorId: string,
): Promise<HerbGardenHarvestResult[]> {
  const rows = await db
    .select({ id: herbGardenPlots.id })
    .from(herbGardenPlots)
    .where(
      and(
        eq(herbGardenPlots.cultivatorId, cultivatorId),
        lte(herbGardenPlots.readyAt, new Date()),
      ),
    );
  const results: HerbGardenHarvestResult[] = [];
  for (const row of rows) {
    try {
      results.push(await harvestHerb(cultivatorId, row.id));
    } catch (error) {
      if (!(error instanceof HerbGardenError) || error.status !== 409) {
        throw error;
      }
    }
  }
  return results;
}

export async function helpFriendPlot(
  actorId: string,
  ownerId: string,
  plotId: string,
): Promise<void> {
  if (actorId === ownerId) {
    throw new HerbGardenError('自己的灵田无需使用访客聚灵', 400);
  }
  await assertFriend(actorId, ownerId);
  await ensureGardenInitialized(ownerId);

  await db.transaction(async (tx) => {
    const [plot] = await tx
      .select()
      .from(herbGardenPlots)
      .where(
        and(
          eq(herbGardenPlots.id, plotId),
          eq(herbGardenPlots.cultivatorId, ownerId),
          gt(herbGardenPlots.readyAt, new Date()),
        ),
      )
      .limit(1);
    if (!plot) {
      throw new HerbGardenError('这株灵植已经成熟或不存在', 409);
    }

    const [countRow] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(herbGardenInteractions)
      .where(
        and(
          eq(herbGardenInteractions.plotId, plotId),
          eq(herbGardenInteractions.action, 'help'),
        ),
      );
    if ((countRow?.count ?? 0) >= HERB_GARDEN_MAX_HELPERS) {
      throw new HerbGardenError('本轮灵植已经得到足够多道友照料', 409);
    }

    const [interaction] = await tx
      .insert(herbGardenInteractions)
      .values({
        plotId,
        ownerId,
        actorId,
        action: 'help',
        herbKey: plot.herbKey,
        payload: { kind: '聚灵' },
      })
      .onConflictDoNothing()
      .returning({ id: herbGardenInteractions.id });
    if (!interaction) {
      throw new HerbGardenError('这一轮你已经帮这株灵植聚过灵了', 409);
    }

    const now = Date.now();
    const remainingMs = Math.max(0, plot.readyAt.getTime() - now);
    const reductionMs = Math.max(60_000, Math.round(remainingMs * 0.03));
    const nextReadyAt = new Date(
      Math.max(now + 60_000, plot.readyAt.getTime() - reductionMs),
    );
    const modifiers =
      (plot.modifierSnapshot as HerbGardenModifierLine[] | null) ?? [];
    await tx
      .update(herbGardenPlots)
      .set({
        readyAt: nextReadyAt,
        modifierSnapshot: [
          ...modifiers,
          {
            source: 'help',
            label: '道友聚灵',
            detail: '好友来访引动灵气，本轮剩余生长时间略有缩短。',
          },
        ],
      })
      .where(eq(herbGardenPlots.id, plotId));
  });
}

export async function stealFriendHerb(
  actorId: string,
  ownerId: string,
  plotId: string,
): Promise<{ herbName: string; rank: Quality; quantity: 1 }> {
  if (actorId === ownerId) {
    throw new HerbGardenError('自己的灵药直接收获即可', 400);
  }
  await assertFriend(actorId, ownerId);
  await ensureGardenInitialized(ownerId);

  return db.transaction(async (tx) => {
    const [plot] = await tx
      .select()
      .from(herbGardenPlots)
      .where(
        and(
          eq(herbGardenPlots.id, plotId),
          eq(herbGardenPlots.cultivatorId, ownerId),
          lte(herbGardenPlots.readyAt, new Date()),
        ),
      )
      .limit(1);
    if (!plot) {
      throw new HerbGardenError('这里没有可采的成熟灵药', 409);
    }
    if (plot.stealLimit <= 0) {
      throw new HerbGardenError('这株灵药数量太少，不宜再采', 409);
    }

    const [interaction] = await tx
      .insert(herbGardenInteractions)
      .values({
        plotId,
        ownerId,
        actorId,
        action: 'steal',
        herbKey: plot.herbKey,
        payload: { quantity: 1 },
      })
      .onConflictDoNothing()
      .returning({ id: herbGardenInteractions.id });
    if (!interaction) {
      throw new HerbGardenError('这一轮你已经顺手采过了', 409);
    }

    const [updated] = await tx
      .update(herbGardenPlots)
      .set({
        remainingYield: sql`${herbGardenPlots.remainingYield} - 1`,
        stolenCount: sql`${herbGardenPlots.stolenCount} + 1`,
      })
      .where(
        and(
          eq(herbGardenPlots.id, plotId),
          gt(herbGardenPlots.remainingYield, 1),
          sql`${herbGardenPlots.stolenCount} < ${herbGardenPlots.stealLimit}`,
        ),
      )
      .returning({ id: herbGardenPlots.id });
    if (!updated) {
      throw new HerbGardenError('可供访客采走的份额已经没有了', 409);
    }

    const herb = findHerbDefinition(plot.herbKey);
    if (!herb) throw new HerbGardenError('灵植记载失效', 500);
    await addMaterialStackToInventory(
      actorId,
      {
        name: herb.name,
        type: 'herb',
        rank: herb.rank,
        element: herb.element,
        description: herb.description,
        details: {
          source: 'friend_herb_garden',
          fromCultivatorId: ownerId,
        },
        quantity: 1,
      },
      tx,
    );
    await tx
      .update(herbGardenProfiles)
      .set({ totalVisits: sql`${herbGardenProfiles.totalVisits} + 1` })
      .where(eq(herbGardenProfiles.cultivatorId, ownerId));
    return { herbName: herb.name, rank: herb.rank, quantity: 1 };
  });
}

async function buildLogs(ownerId: string): Promise<HerbGardenLogView[]> {
  const rows = await db
    .select({
      id: herbGardenInteractions.id,
      action: herbGardenInteractions.action,
      actorId: herbGardenInteractions.actorId,
      ownerId: herbGardenInteractions.ownerId,
      herbKey: herbGardenInteractions.herbKey,
      createdAt: herbGardenInteractions.createdAt,
    })
    .from(herbGardenInteractions)
    .where(eq(herbGardenInteractions.ownerId, ownerId))
    .orderBy(desc(herbGardenInteractions.createdAt))
    .limit(20);
  if (rows.length === 0) return [];

  const actorIds = [...new Set(rows.map((row) => row.actorId))];
  const actors = await db
    .select({ id: cultivators.id, name: cultivators.name })
    .from(cultivators)
    .where(inArray(cultivators.id, actorIds));
  const names = new Map(actors.map((actor) => [actor.id, actor.name]));

  return rows.map((row) => {
    const herbName = findHerbDefinition(row.herbKey)?.name ?? row.herbKey;
    const actorName = names.get(row.actorId) ?? '一位道友';
    const action = row.action as HerbGardenLogView['action'];
    const message =
      action === 'steal'
        ? `${actorName}来过药田，顺手采走「${herbName} ×1」。`
        : action === 'help'
          ? `${actorName}为「${herbName}」引动灵气，助其生长。`
          : action === 'harvest'
            ? `你收获了一轮「${herbName}」。`
            : `你在灵畦播下了「${herbName}」。`;
    return {
      id: row.id,
      action,
      actorId: row.actorId,
      actorName,
      ownerId: row.ownerId,
      herbName,
      message,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

async function buildFriendList(cultivatorId: string) {
  const relations = await db
    .select({ friendId: cultivatorFriends.friendCultivatorId })
    .from(cultivatorFriends)
    .where(eq(cultivatorFriends.cultivatorId, cultivatorId));
  const friendIds = relations.map((row) => row.friendId);
  if (friendIds.length === 0) return [];

  const [friends, plots] = await Promise.all([
    db
      .select({
        id: cultivators.id,
        name: cultivators.name,
        realm: cultivators.realm,
      })
      .from(cultivators)
      .where(
        and(
          inArray(cultivators.id, friendIds),
          eq(cultivators.status, 'active'),
        ),
      ),
    db
      .select({
        ownerId: herbGardenPlots.cultivatorId,
        readyAt: herbGardenPlots.readyAt,
      })
      .from(herbGardenPlots)
      .where(inArray(herbGardenPlots.cultivatorId, friendIds)),
  ]);
  const now = Date.now();
  return friends
    .map((friend) => {
      const ownPlots = plots.filter((plot) => plot.ownerId === friend.id);
      return {
        cultivatorId: friend.id,
        name: friend.name,
        realm: friend.realm,
        readyPlots: ownPlots.filter((plot) => plot.readyAt.getTime() <= now)
          .length,
        growingPlots: ownPlots.filter((plot) => plot.readyAt.getTime() > now)
          .length,
        canVisit: true,
      };
    })
    .sort(
      (a, b) =>
        b.readyPlots - a.readyPlots || a.name.localeCompare(b.name, 'zh-CN'),
    );
}

export async function getHerbGardenState(
  viewerId: string,
  ownerId = viewerId,
): Promise<HerbGardenState> {
  await assertFriend(viewerId, ownerId);
  const ownerName = await assertActiveCultivator(ownerId);
  await ensureGardenInitialized(ownerId);
  const isSelf = viewerId === ownerId;

  const [
    profileRows,
    rows,
    logs,
    gardenLevel,
    seeds,
    friends,
    viewerInteractions,
  ] = await Promise.all([
    db
      .select({ totalHarvests: herbGardenProfiles.totalHarvests })
      .from(herbGardenProfiles)
      .where(eq(herbGardenProfiles.cultivatorId, ownerId))
      .limit(1),
    db
      .select()
      .from(herbGardenPlots)
      .where(eq(herbGardenPlots.cultivatorId, ownerId)),
    buildLogs(ownerId),
    getGardenLevel(ownerId),
    isSelf ? listSeedStacks(ownerId) : Promise.resolve([]),
    isSelf ? buildFriendList(ownerId) : Promise.resolve([]),
    isSelf
      ? Promise.resolve([])
      : db
          .select({
            plotId: herbGardenInteractions.plotId,
            action: herbGardenInteractions.action,
          })
          .from(herbGardenInteractions)
          .where(
            and(
              eq(herbGardenInteractions.actorId, viewerId),
              eq(herbGardenInteractions.ownerId, ownerId),
              inArray(herbGardenInteractions.action, ['help', 'steal']),
            ),
          ),
  ]);

  const actionsByPlot = new Map<string, Set<string>>();
  for (const interaction of viewerInteractions) {
    if (!interaction.plotId) continue;
    const actions = actionsByPlot.get(interaction.plotId) ?? new Set<string>();
    actions.add(interaction.action);
    actionsByPlot.set(interaction.plotId, actions);
  }

  const helperCounts = new Map<string, number>();
  if (rows.length > 0) {
    const counts = await db
      .select({
        plotId: herbGardenInteractions.plotId,
        count: sql<number>`count(*)::int`,
      })
      .from(herbGardenInteractions)
      .where(
        and(
          inArray(
            herbGardenInteractions.plotId,
            rows.map((row) => row.id),
          ),
          eq(herbGardenInteractions.action, 'help'),
        ),
      )
      .groupBy(herbGardenInteractions.plotId);
    for (const row of counts) {
      if (row.plotId) helperCounts.set(row.plotId, row.count);
    }
  }

  const now = Date.now();
  const bySlot = new Map(rows.map((row) => [row.slot, row]));
  const plots = Array.from({ length: HERB_GARDEN_PLOT_COUNT }, (_, index) => {
    const slot = index + 1;
    const row = bySlot.get(slot);
    if (!row) return { slot, status: 'empty' as const };
    const herb = findHerbDefinition(row.herbKey);
    const ready = row.readyAt.getTime() <= now;
    const actions = actionsByPlot.get(row.id) ?? new Set<string>();
    const helperCount = helperCounts.get(row.id) ?? 0;
    return {
      slot,
      plotId: row.id,
      status: ready ? ('ready' as const) : ('growing' as const),
      herbKey: row.herbKey,
      herbName: herb?.name ?? row.herbKey,
      herbRank: herb?.rank,
      element: herb?.element,
      seedQuality: isHerbSeedQuality(row.seedQuality)
        ? row.seedQuality
        : '普通种',
      plantedAt: row.plantedAt.toISOString(),
      readyAt: row.readyAt.toISOString(),
      baseYield: row.baseYield,
      remainingYield: row.remainingYield,
      stealLimit: row.stealLimit,
      stolenCount: row.stolenCount,
      mutationChance: row.mutationChance,
      mutationRank: ready ? (row.mutationRank as Quality | null) : null,
      seedReturnChance: row.seedReturnChance,
      modifiers:
        (row.modifierSnapshot as HerbGardenModifierLine[] | null) ?? [],
      helperCount,
      alreadyHelped: actions.has('help'),
      alreadyStolen: actions.has('steal'),
      canHelp:
        !isSelf &&
        !ready &&
        helperCount < HERB_GARDEN_MAX_HELPERS &&
        !actions.has('help'),
      canSteal:
        !isSelf &&
        ready &&
        row.stolenCount < row.stealLimit &&
        row.remainingYield > 1 &&
        !actions.has('steal'),
    };
  });

  const occupied = plots.filter((plot) => plot.status !== 'empty');
  return {
    owner: { cultivatorId: ownerId, name: ownerName, isSelf },
    gardenLevel,
    plots,
    seeds,
    logs,
    friends,
    summary: {
      planted: occupied.length,
      ready: occupied.filter((plot) => plot.status === 'ready').length,
      averageMutationChance:
        occupied.length === 0
          ? 0
          : occupied.reduce(
              (sum, plot) => sum + (plot.mutationChance ?? 0),
              0,
            ) / occupied.length,
      totalHarvests: profileRows[0]?.totalHarvests ?? 0,
    },
  };
}
