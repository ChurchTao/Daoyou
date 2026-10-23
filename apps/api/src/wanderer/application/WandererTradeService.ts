import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import type {
  WandererBeastOffer,
  WandererBeastSale,
  WandererBeastSaleResult,
  WandererBookPurchaseResult,
  WandererDewPurchaseResult,
  WandererIncensePurchaseResult,
  WandererPurchase,
  WandererState,
} from '@daoyou/contracts/wanderer';
import { BEAST_LURE } from '@daoyou/game-content/items/beasts';
import { findItemDefinition } from '@daoyou/game-content/items';
import {
  InventoryRuleError,
  type ItemGrant,
} from '@daoyou/game-domain/inventory';
import {
  WANDERER_DEW_PRICE,
  WANDERER_INCENSE_PRICE,
  WANDERER_SUPERIOR_DEW_ID,
  wandererAppearance,
  wandererBookPrice,
  wandererSuperiorBookIds,
} from '@daoyou/game-rules/wanderer';
import { assertBeastIdle } from '@server/combat/application/BeastMutationGuard.js';
import { updateSpiritStones } from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import {
  InventoryError,
  assertInventoryIdle,
  grantInventory,
} from '@server/inventory/operations.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { db } from '@server/lib/drizzle/db.js';
import {
  cultivatorBeasts,
  wandererBookSales,
} from '@server/lib/drizzle/schema.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import {
  readBeastRoster,
  saveBeastLineup,
} from '@server/lib/repositories/combatV6BeastRepository.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { and, eq, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';

export class WandererError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function readWandererState(
  now = Date.now(),
): Promise<WandererState> {
  const appearance = wandererAppearance(now);
  const sales = await readBookSales(appearance.id);
  return {
    id: appearance.id,
    regionId: appearance.regionId,
    regionName: appearance.regionName,
    x: appearance.x,
    y: appearance.y,
    startsAt: appearance.startsAt,
    expiresAt: appearance.expiresAt,
    serverNow: now,
    wantedSpeciesId: appearance.wantedSpeciesId,
    wantedSpeciesName: appearance.wantedSpeciesName,
    bookPrice: wandererBookPrice(sales),
    dewPrice: WANDERER_DEW_PRICE,
    incensePrice: WANDERER_INCENSE_PRICE,
  };
}

export async function readWandererBeasts(
  cultivatorId: string,
  now = Date.now(),
): Promise<WandererBeastOffer[]> {
  const appearance = wandererAppearance(now);
  const roster = await readBeastRoster(cultivatorId, db);
  const offers = new Map(
    appearance.offers.map((offer) => [offer.speciesId, offer]),
  );
  return roster.beasts.flatMap((beast) => {
    if (!beast.isMutant) return [];
    const offer = offers.get(beast.speciesId);
    if (!offer) return [];
    return [
      {
        id: beast.id,
        name: beast.name,
        speciesId: beast.speciesId,
        speciesName: offer.speciesName,
        level: beast.level,
        revision: beast.revision,
        lead: roster.lineup.leadBeastId === beast.id,
        isLocked: !!beast.isLocked,
        bottles: offer.bottles,
      },
    ];
  });
}

export async function sellWandererBeast(
  actor: ActiveCultivatorRef,
  input: WandererBeastSale,
): Promise<WandererBeastSaleResult> {
  await assertBeastIdle(actor.cultivatorId);
  await assertInventoryIdle(actor.cultivatorId);
  const committed = await playerCommandExecutor.executeWithLock({
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'wanderer-beast-sale',
    requestId: input.requestId,
    idempotency: {
      key: input.requestId,
      fingerprint: JSON.stringify(input),
    },
    lock: { context: 'wanderer-beast-sale', timeoutMs: 30_000 },
    command: (tx) => sellBeast(actor, input, tx),
  });
  return committed.result;
}

export async function buyWandererBook(
  actor: ActiveCultivatorRef,
  input: WandererPurchase,
): Promise<WandererBookPurchaseResult> {
  await assertInventoryIdle(actor.cultivatorId);
  const appearance = wandererAppearance(Date.now());
  const committed = await withRedisLock(
    {
      keys: [
        redisLockKeys.cultivatorMutation(actor.cultivatorId),
        `lock:wanderer:book:${appearance.id}`,
      ],
      context: 'wanderer-book',
      timeoutMs: 30_000,
      retries: 0,
    },
    (lease) =>
      playerCommandExecutor.execute({
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
        source: 'wanderer-book-purchase',
        requestId: input.requestId,
        idempotency: {
          key: input.requestId,
          fingerprint: `${appearance.id}:${input.expectedPrice}`,
        },
        coordination: { mode: 'redis', lease },
        command: (tx) => buyBook(actor, input, tx),
      }),
  );
  return committed.result;
}

export async function buyWandererIncense(
  actor: ActiveCultivatorRef,
  input: WandererPurchase,
): Promise<WandererIncensePurchaseResult> {
  await assertInventoryIdle(actor.cultivatorId);
  const committed = await playerCommandExecutor.executeWithLock({
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'wanderer-incense-purchase',
    requestId: input.requestId,
    idempotency: {
      key: input.requestId,
      fingerprint: `incense:${input.expectedPrice}`,
    },
    lock: { context: 'wanderer-incense', timeoutMs: 30_000 },
    command: (tx) => buyIncense(actor, input, tx),
  });
  return committed.result;
}

export async function buyWandererDew(
  actor: ActiveCultivatorRef,
  input: WandererPurchase,
): Promise<WandererDewPurchaseResult> {
  await assertInventoryIdle(actor.cultivatorId);
  const committed = await playerCommandExecutor.executeWithLock({
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'wanderer-dew-purchase',
    requestId: input.requestId,
    idempotency: {
      key: input.requestId,
      fingerprint: `dew:${input.expectedPrice}`,
    },
    lock: { context: 'wanderer-dew', timeoutMs: 30_000 },
    command: (tx) => buyDew(actor, input, tx),
  });
  return committed.result;
}

async function sellBeast(
  actor: ActiveCultivatorRef,
  input: WandererBeastSale,
  tx: DbTransaction,
) {
  await assertInventoryIdle(actor.cultivatorId, tx);
  const appearance = wandererAppearance(Date.now());
  const roster = await readBeastRoster(actor.cultivatorId, tx);
  const beast = roster.beasts.find((entry) => entry.id === input.beastId);
  if (!beast || beast.revision !== input.expectedRevision)
    throw new WandererError(409, '灵兽已有变化，请重新查看');
  if (beast.isLocked) throw new WandererError(409, '灵兽已锁定，请先解锁');
  if (!beast.isMutant) throw new WandererError(400, '云游商人只收变异灵兽');
  if (roster.lineup.leadBeastId === beast.id)
    throw new WandererError(400, '请先取消首发');
  if (roster.lineup.carriedBeastIds.includes(beast.id))
    await saveBeastLineup(
      actor.cultivatorId,
      {
        carriedBeastIds: roster.lineup.carriedBeastIds.filter(
          (id) => id !== beast.id,
        ),
        leadBeastId: roster.lineup.leadBeastId,
        revision: roster.lineup.revision + 1,
      },
      tx,
    );
  const offer = appearance.offers.find(
    (entry) => entry.speciesId === beast.speciesId,
  );
  if (!offer) throw new WandererError(400, '这种灵兽游商不收');
  if (offer.bottles !== input.expectedBottles)
    throw new WandererError(409, '今日收购价已变化，请重新确认');
  const deleted = await tx
    .delete(cultivatorBeasts)
    .where(
      and(
        eq(cultivatorBeasts.id, beast.id),
        eq(cultivatorBeasts.cultivatorId, actor.cultivatorId),
        sql`${cultivatorBeasts.individual}->>'revision' = ${String(input.expectedRevision)}`,
      ),
    )
    .returning({ id: cultivatorBeasts.id });
  if (deleted.length !== 1)
    throw new WandererError(409, '灵兽已有变化，请重新查看');
  await giveItems(
    actor.cultivatorId,
    WANDERER_SUPERIOR_DEW_ID,
    offer.bottles,
    tx,
  );
  const result: WandererBeastSaleResult = {
    beastName: beast.name,
    bottles: offer.bottles,
  };
  return { result, resourceChanges: bagChange() };
}

async function buyBook(
  actor: ActiveCultivatorRef,
  input: WandererPurchase,
  tx: DbTransaction,
) {
  await assertInventoryIdle(actor.cultivatorId, tx);
  const appearance = wandererAppearance(Date.now());
  const sales = await lockBookSales(appearance.id, tx);
  const price = wandererBookPrice(sales);
  if (price === null) throw new WandererError(400, '此印今日已不可再售');
  if (price !== input.expectedPrice)
    throw new WandererError(409, '标价已变化，请按现价重新确认');
  const books = wandererSuperiorBookIds();
  const definitionId = books[randomInt(books.length)];
  if (!definitionId) throw new WandererError(500, '上品传承灵印暂时无货');
  const definition = findItemDefinition(definitionId);
  if (!definition || definition.kind !== 'beast_book')
    throw new WandererError(500, '上品传承灵印暂时无货');
  const spiritStones = await spendSpiritStones(
    tx,
    actor.userId,
    actor.cultivatorId,
    price,
  );
  await giveItems(actor.cultivatorId, definitionId, 1, tx);
  await tx
    .update(wandererBookSales)
    .set({ sales: sales + 1, updatedAt: new Date() })
    .where(eq(wandererBookSales.windowId, appearance.id));
  const result: WandererBookPurchaseResult = {
    itemName: '上品传承灵印',
    skillName: definition.name,
    definitionId,
    price,
    nextPrice: wandererBookPrice(sales + 1),
    spiritStones,
  };
  return {
    result,
    resourceChanges: [
      ...bagChange(),
      currencyChange('currency.wanderer.book', spiritStones),
    ],
  };
}

async function buyIncense(
  actor: ActiveCultivatorRef,
  input: WandererPurchase,
  tx: DbTransaction,
) {
  await assertInventoryIdle(actor.cultivatorId, tx);
  if (input.expectedPrice !== WANDERER_INCENSE_PRICE)
    throw new WandererError(409, '标价已变化，请按现价重新确认');
  const definition = findItemDefinition(BEAST_LURE.id);
  if (!definition || definition.kind !== 'beast_lure')
    throw new WandererError(500, '引妖香暂时无货');
  const spiritStones = await spendSpiritStones(
    tx,
    actor.userId,
    actor.cultivatorId,
    WANDERER_INCENSE_PRICE,
  );
  await giveItems(actor.cultivatorId, BEAST_LURE.id, 1, tx);
  const result: WandererIncensePurchaseResult = {
    itemName: definition.name,
    quantity: 1,
    price: WANDERER_INCENSE_PRICE,
    spiritStones,
  };
  return {
    result,
    resourceChanges: [
      ...bagChange(),
      currencyChange('currency.wanderer.incense', spiritStones),
    ],
  };
}

async function buyDew(
  actor: ActiveCultivatorRef,
  input: WandererPurchase,
  tx: DbTransaction,
) {
  await assertInventoryIdle(actor.cultivatorId, tx);
  if (input.expectedPrice !== WANDERER_DEW_PRICE)
    throw new WandererError(409, '标价已变化，请按现价重新确认');
  const definition = findItemDefinition(WANDERER_SUPERIOR_DEW_ID);
  if (!definition) throw new WandererError(500, '上品归元灵露暂时无货');
  const spiritStones = await spendSpiritStones(
    tx,
    actor.userId,
    actor.cultivatorId,
    WANDERER_DEW_PRICE,
  );
  await giveItems(actor.cultivatorId, WANDERER_SUPERIOR_DEW_ID, 1, tx);
  const result: WandererDewPurchaseResult = {
    itemName: definition.name,
    quantity: 1,
    price: WANDERER_DEW_PRICE,
    spiritStones,
  };
  return {
    result,
    resourceChanges: [
      ...bagChange(),
      currencyChange('currency.wanderer.dew', spiritStones),
    ],
  };
}

async function readBookSales(windowId: string) {
  const [row] = await db
    .select({ sales: wandererBookSales.sales })
    .from(wandererBookSales)
    .where(eq(wandererBookSales.windowId, windowId))
    .limit(1);
  return row?.sales ?? 0;
}

async function lockBookSales(windowId: string, tx: DbTransaction) {
  await tx
    .insert(wandererBookSales)
    .values({ windowId, sales: 0 })
    .onConflictDoNothing();
  const [row] = await tx
    .select({ sales: wandererBookSales.sales })
    .from(wandererBookSales)
    .where(eq(wandererBookSales.windowId, windowId))
    .for('update');
  if (!row) throw new WandererError(500, '灵印标价暂时无法确定');
  return row.sales;
}

async function spendSpiritStones(
  tx: DbTransaction,
  userId: string,
  cultivatorId: string,
  price: number,
) {
  if (!Number.isSafeInteger(price) || price <= 0)
    throw new WandererError(400, '标价无效');
  try {
    return await updateSpiritStones(userId, cultivatorId, -price, tx);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('灵石不足'))
      throw new WandererError(400, '灵石不足');
    throw error;
  }
}

async function giveItems(
  cultivatorId: string,
  definitionId: string,
  quantity: number,
  tx: DbTransaction,
  instanceData?: ItemGrant['instanceData'],
) {
  try {
    await grantInventory(
      cultivatorId,
      [{ definitionId, quantity, ...(instanceData ? { instanceData } : {}) }],
      tx,
      false,
    );
  } catch (error) {
    if (error instanceof InventoryRuleError || error instanceof InventoryError)
      throw new WandererError(400, '背包放不下，这笔交易没有成交');
    throw error;
  }
}

function bagChange(): ResourceChangeDescriptor[] {
  return [
    {
      resourceTopic: 'inventory.bag',
      eventType: 'inventory.wanderer.changed',
      operation: 'invalidate',
    },
  ];
}

function currencyChange(
  eventType: string,
  spiritStones: number,
): ResourceChangeDescriptor {
  return {
    resourceTopic: 'player.currency',
    eventType,
    operation: 'merge',
    payload: { spiritStones },
  };
}
