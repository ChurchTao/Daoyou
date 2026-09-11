import { hasActiveRanking } from '@server/lib/redis/rankingChallenge';
import { readCharacterEquipment } from '@server/lib/repositories/characterLoadoutRepository';
import { hasActiveTower } from '@server/lib/tower/occupancy';
import type {
  InventoryAction,
  InventoryQuerySchema,
  InventoryView,
} from '@shared/contracts/inventory';
import {
  compileDaoEquipmentSpecialLoadoutV1,
  type DaoEquipmentInstanceV1,
} from '@shared/engine/combat-v6/equipment';
import {
  addItems,
  BAG_CAPACITY,
  emptySlot,
  InventoryItemSchema,
  itemDefinition,
  learnBeastSkill,
  sameStack,
  sortBag,
  type InventoryItem,
  type ItemGrant,
} from '@shared/inventory';
import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import { MaterialFactsSchema } from '@shared/items/definitions/materials';
import { SeedFactsSchema } from '@shared/items/definitions/seeds';
import { ITEM_DEFINITIONS } from '@shared/items/registry';
import { and, asc, count, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { db, type DbTransaction } from '../drizzle/db';
import {
  cultivatorBeasts,
  cultivatorEquipmentSlots,
  inventoryItems,
} from '../drizzle/schema';
import { hasActiveDungeon } from '../dungeon/occupancy';
import { redis } from '../redis';
import { redisLockKeys, withRedisLock } from '../redis/lock';
import {
  beastIndividualData,
  readBeastOwner,
  readBeastRoster,
} from '../repositories/combatV6BeastRepository';
import { lockCultivatorForStateMutation } from '../repositories/playerStateRepository';
import { arenaOccupancyKey } from './combat-v6/CombatV6ArenaStore';
import { hasActiveBreakthroughBattle } from './combat-v6/CombatV6BreakthroughOccupancy';
import { CombatV6RuntimeStore } from './combat-v6/CombatV6RuntimeStore';
import { hasActiveSectTaskBattle } from './combat-v6/CombatV6SectTaskOccupancy';
import { CombatV6WildStore } from './combat-v6/CombatV6WildStore';
import { inventoryStackKey } from './inventoryStackKey';
import { ResourceEventCommitter } from './ResourceEventCommitter';

export class InventoryError extends Error {}
export function inventoryItemOf(
  row: typeof inventoryItems.$inferSelect,
): InventoryItem {
  const item = InventoryItemSchema.parse({
    id: row.id,
    location: row.location,
    slotIndex: row.slotIndex,
    definitionId: row.definitionId,
    quantity: row.quantity,
    instanceData: row.instanceData,
    stackKey: row.stackKey,
    revision: row.revision,
  });
  if (item.definitionId === 'seed.v1')
    item.instanceData = SeedFactsSchema.parse(item.instanceData);
  if (item.definitionId === 'material.v1')
    item.instanceData = MaterialFactsSchema.parse(item.instanceData);
  if (item.definitionId === 'consumable.v1')
    item.instanceData = ConsumableFactsSchema.parse(item.instanceData);
  return item;
}
export async function assertInventoryIdle(owner: string) {
  if (
    (await hasActiveTower(owner)) ||
    (await hasActiveRanking(owner)) ||
    (await hasActiveDungeon(owner)) ||
    (await hasActiveSectTaskBattle(owner)) ||
    (await hasActiveBreakthroughBattle(owner)) ||
    (await new CombatV6WildStore().lock(owner)) ||
    (await new CombatV6RuntimeStore().currentId(owner)) ||
    (await redis.get(arenaOccupancyKey(owner)))
  )
    throw new InventoryError('请先结束战斗与结算，再调整物品');
}
export async function readInventory(
  owner: string,
  query: z.infer<typeof InventoryQuerySchema>,
): Promise<InventoryView> {
  const ownerFilter = eq(inventoryItems.cultivatorId, owner);
  const matches = ITEM_DEFINITIONS.filter((i) =>
    i.name.includes(query.search),
  ).map((i) => i.id);
  const filter = and(
    ownerFilter,
    eq(inventoryItems.location, query.location),
    query.kind === 'all'
      ? undefined
      : inArray(
          inventoryItems.definitionId,
          ITEM_DEFINITIONS.filter((i) => i.kind === query.kind).map(
            (i) => i.id,
          ),
        ),
    query.search
      ? or(
          inArray(inventoryItems.definitionId, matches),
          ilike(
            sql`${inventoryItems.instanceData}->>'name'`,
            `%${query.search.replace(/[\\%_]/g, '\\$&')}%`,
          ),
        )
      : undefined,
  );
  const [requestedRows, totals, usage] = await Promise.all([
    db
      .select()
      .from(inventoryItems)
      .where(filter)
      .orderBy(asc(inventoryItems.slotIndex), asc(inventoryItems.id))
      .limit(query.location === 'bag' ? BAG_CAPACITY : 40)
      .offset(query.location === 'bag' ? 0 : query.page * 40),
    db.select({ value: count() }).from(inventoryItems).where(filter),
    db
      .select({ value: count() })
      .from(inventoryItems)
      .where(and(ownerFilter, eq(inventoryItems.location, 'bag'))),
  ]);
  const page =
    query.location === 'bag'
      ? 0
      : Math.min(query.page, Math.max(0, Math.ceil(totals[0].value / 40) - 1));
  const rows =
    page === query.page || query.location === 'bag'
      ? requestedRows
      : await db
          .select()
          .from(inventoryItems)
          .where(filter)
          .orderBy(asc(inventoryItems.slotIndex), asc(inventoryItems.id))
          .limit(40)
          .offset(page * 40);
  const equipped = rows.length
    ? await db
        .select({ id: cultivatorEquipmentSlots.equipmentInstanceId })
        .from(cultivatorEquipmentSlots)
        .where(
          inArray(
            cultivatorEquipmentSlots.equipmentInstanceId,
            rows.map((r) => r.id),
          ),
        )
    : [];
  const ids = new Set(equipped.map((i) => i.id));
  return {
    items: rows.map((row) => ({
      ...inventoryItemOf(row),
      ...(row.definitionId === 'seed.v1'
        ? {
            instanceData: (() => {
              const { plant } = SeedFactsSchema.parse(
                row.instanceData,
              ).seedSpec;
              return {
                name: plant.seedName,
                rank: plant.quality,
                description: `${plant.seedDescription}\n${plant.clueTexts.join('；')}`,
              };
            })(),
          }
        : {}),
      name:
        row.definitionId === 'equipment.v6' ||
        row.definitionId === 'material.v1' ||
        row.definitionId === 'seed.v1' ||
        row.definitionId === 'consumable.v1'
          ? (row.instanceData as DaoEquipmentInstanceV1).name
          : itemDefinition(row.definitionId).name,
      equipped: ids.has(row.id),
    })),
    total: totals[0].value,
    used: usage[0].value,
    capacity: BAG_CAPACITY,
    page,
  };
}

/** Caller holds the character SQL lock. Apply only changed rows, with stale-write guards. */
export async function saveInventoryPlan(
  owner: string,
  before: InventoryItem[],
  after: InventoryItem[],
  tx: DbTransaction,
) {
  const nextIds = new Set(after.map((i) => i.id));
  for (const old of before) {
    const next = after.find((i) => i.id === old.id);
    if (next && JSON.stringify(next) === JSON.stringify(old)) continue;
    const filter = and(
      eq(inventoryItems.id, old.id),
      eq(inventoryItems.cultivatorId, owner),
      eq(inventoryItems.revision, old.revision),
    );
    // Release bag slots before swaps; the transaction never exposes temporary positions.
    const rows = nextIds.has(old.id)
      ? await tx
          .update(inventoryItems)
          .set({ location: 'storage', slotIndex: null })
          .where(filter)
          .returning({ id: inventoryItems.id })
      : await tx
          .delete(inventoryItems)
          .where(filter)
          .returning({ id: inventoryItems.id });
    if (!rows.length) throw new InventoryError('物品已变化，请刷新');
  }
  const oldMap = new Map(before.map((i) => [i.id, i]));
  for (const next of after) {
    const old = oldMap.get(next.id);
    if (old && JSON.stringify(old) === JSON.stringify(next)) continue;
    if (old)
      await tx
        .update(inventoryItems)
        .set({ ...next, updatedAt: new Date() })
        .where(
          and(
            eq(inventoryItems.id, next.id),
            eq(inventoryItems.cultivatorId, owner),
          ),
        );
    else
      await tx.insert(inventoryItems).values({ ...next, cultivatorId: owner });
  }
}
export async function grantInventory(
  owner: string,
  grants: ItemGrant[],
  tx: DbTransaction,
  overflow = true,
) {
  if (!grants.length) return [];
  // Only relevant stacks and the bounded bag are needed, even with an unlimited store.
  const before = (
    await tx
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.cultivatorId, owner),
          or(
            eq(inventoryItems.location, 'bag'),
            or(
              ...grants.map((g) =>
                and(
                  eq(inventoryItems.definitionId, g.definitionId),
                  eq(
                    inventoryItems.stackKey,
                    inventoryStackKey(g.definitionId, g.instanceData) ?? '',
                  ),
                  sql`${inventoryItems.quantity} < ${itemDefinition(g.definitionId).stackLimit}`,
                ),
              ),
            ),
          ),
        ),
      )
  ).map(inventoryItemOf);
  let next = before;
  for (const grant of grants)
    next = addItems(
      next,
      grant,
      'bag',
      overflow,
      randomUUID,
      inventoryStackKey(grant.definitionId, grant.instanceData),
    );
  await saveInventoryPlan(owner, before, next, tx);
  return next.filter(
    (item) =>
      item.quantity >
      (before.find((previous) => previous.id === item.id)?.quantity ?? 0),
  );
}
export async function mutateInventory(owner: string, input: InventoryAction) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(owner),
      context: 'inventory',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        await lockCultivatorForStateMutation(tx, owner);
        await assertInventoryIdle(owner);
        const before = (
          await tx
            .select()
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.cultivatorId, owner),
                or(
                  eq(inventoryItems.location, 'bag'),
                  input.action === 'sort'
                    ? undefined
                    : eq(inventoryItems.id, input.id),
                ),
              ),
            )
        ).map(inventoryItemOf);
        if (input.action === 'transfer' && input.location === 'storage') {
          const source = before.find((i) => i.id === input.id);
          if (source) {
            const stacks = await tx
              .select()
              .from(inventoryItems)
              .where(
                and(
                  eq(inventoryItems.cultivatorId, owner),
                  eq(inventoryItems.location, 'storage'),
                  eq(inventoryItems.definitionId, source.definitionId),
                  eq(inventoryItems.stackKey, source.stackKey ?? ''),
                  sql`${inventoryItems.quantity} < ${itemDefinition(source.definitionId).stackLimit}`,
                ),
              )
              .orderBy(asc(inventoryItems.id))
              .limit(1);
            before.push(...stacks.map(inventoryItemOf));
          }
        }
        let next = before.map((i) => ({ ...i }));
        const item =
          input.action === 'sort'
            ? undefined
            : next.find(
                (i) => i.id === input.id && i.revision === input.revision,
              );
        if (input.action !== 'sort' && !item)
          throw new InventoryError('物品已变化，请刷新后重试');
        let result: { oldSkill?: string; newSkill?: string } = {};
        if (input.action === 'sort') {
          const bag = next.filter((i) => i.location === 'bag');
          if (
            bag.length !== input.items.length ||
            new Set(input.items.map((i) => i.id)).size !== input.items.length ||
            input.items.some(
              (ref) =>
                !bag.some(
                  (i) => i.id === ref.id && i.revision === ref.revision,
                ),
            )
          )
            throw new InventoryError('背包已变化，请刷新');
          next = sortBag(next);
        } else if (item) {
          const equipped = await tx
            .select()
            .from(cultivatorEquipmentSlots)
            .where(eq(cultivatorEquipmentSlots.equipmentInstanceId, item.id));
          if (input.action === 'transfer') {
            if (equipped.length) throw new InventoryError('请先卸下装备');
            if (item.location === input.location)
              throw new InventoryError('物品已在该位置');
            next = next.filter((i) => i.id !== item.id);
            if (itemDefinition(item.definitionId).stackLimit > 1)
              next = addItems(
                next,
                {
                  definitionId: item.definitionId,
                  quantity: item.quantity,
                  ...(item.definitionId === 'seed.v1'
                    ? { instanceData: SeedFactsSchema.parse(item.instanceData) }
                    : item.definitionId === 'material.v1'
                      ? {
                          instanceData: MaterialFactsSchema.parse(
                            item.instanceData,
                          ),
                        }
                      : item.definitionId === 'consumable.v1'
                        ? {
                            instanceData: ConsumableFactsSchema.parse(
                              item.instanceData,
                            ),
                          }
                        : {}),
                },
                input.location,
                false,
                () => item.id,
                item.stackKey,
              ).map((entry) =>
                entry.id === item.id
                  ? { ...entry, revision: item.revision + 1 }
                  : entry,
              );
            else {
              const slotIndex =
                input.location === 'bag' ? emptySlot(next) : null;
              if (input.location === 'bag' && slotIndex === null)
                throw new InventoryError('背包格子不足');
              next.push({
                ...item,
                location: input.location,
                slotIndex,
                revision: item.revision + 1,
              });
            }
          } else if (input.action === 'move') {
            if (item.location !== 'bag')
              throw new InventoryError('请先取出物品');
            const target = next.find(
              (i) => i.location === 'bag' && i.slotIndex === input.slot,
            );
            if (
              (target?.id ?? null) !== input.targetId ||
              (target?.revision ?? null) !== input.targetRevision
            )
              throw new InventoryError('目标格位已变化，请刷新');
            if (target?.id === item.id) {
              lease.assertHeld();
              return result;
            }
            if (target && sameStack(item, target)) {
              const amount = Math.min(
                item.quantity,
                itemDefinition(item.definitionId).stackLimit - target.quantity,
              );
              if (!amount) throw new InventoryError('目标堆叠已满');
              item.quantity -= amount;
              target.quantity += amount;
              target.revision++;
              if (!item.quantity) next = next.filter((i) => i.id !== item.id);
            } else {
              if (target) {
                target.slotIndex = item.slotIndex;
                target.revision++;
              }
              item.slotIndex = input.slot;
            }
            item.revision++;
          } else if (input.action === 'split') {
            if (
              item.location !== 'bag' ||
              itemDefinition(item.definitionId).stackLimit === 1 ||
              input.quantity >= item.quantity
            )
              throw new InventoryError('拆分数量无效');
            const slotIndex = emptySlot(next);
            if (slotIndex === null) throw new InventoryError('背包格子不足');
            item.quantity -= input.quantity;
            item.revision++;
            next.push({
              ...item,
              id: randomUUID(),
              quantity: input.quantity,
              slotIndex,
              revision: 0,
            });
          } else if (input.action === 'learn') {
            if (item.location !== 'bag')
              throw new InventoryError('请先从储藏室取出兽诀');
            const roster = await readBeastRoster(owner, tx);
            const beast = roster.beasts.find(
              (b) =>
                b.id === input.beastId && b.revision === input.beastRevision,
            );
            if (!beast || !beast.skillSlotCapacity)
              throw new InventoryError('灵兽已变化或没有技能格');
            const slot = randomInt(beast.skillSlotCapacity);
            const learned = learnBeastSkill(
              beast,
              item.definitionId,
              roster.ownerLevel,
              slot,
            );
            await tx
              .update(cultivatorBeasts)
              .set({ individual: beastIndividualData(learned) })
              .where(
                and(
                  eq(cultivatorBeasts.id, beast.id),
                  eq(cultivatorBeasts.cultivatorId, owner),
                ),
              );
            result = {
              oldSkill: beast.skills[slot],
              newSkill: learned.skills[slot],
            };
            item.quantity--;
            item.revision++;
            if (!item.quantity) next = next.filter((i) => i.id !== item.id);
          } else if (input.action === 'equip') {
            if (item.location !== 'bag' || item.definitionId !== 'equipment.v6')
              throw new InventoryError('请先将道装取入背包');
            const equipment = item.instanceData as DaoEquipmentInstanceV1;
            const [previous] = await tx
              .select()
              .from(cultivatorEquipmentSlots)
              .where(
                and(
                  eq(cultivatorEquipmentSlots.cultivatorId, owner),
                  eq(cultivatorEquipmentSlots.slot, equipment.slot),
                ),
              );
            if (input.equipped && previous?.equipmentInstanceId === item.id)
              throw new InventoryError('该物品已装备');
            if (!input.equipped && previous?.equipmentInstanceId !== item.id)
              throw new InventoryError('装备状态已变化，请刷新');
            const replaced = next.find(
              (entry) =>
                entry.id === previous?.equipmentInstanceId &&
                entry.id !== item.id,
            );
            if (input.equipped && replaced) replaced.revision++;
            if (input.equipped) {
              await tx
                .insert(cultivatorEquipmentSlots)
                .values({
                  cultivatorId: owner,
                  slot: equipment.slot,
                  equipmentInstanceId: item.id,
                })
                .onConflictDoUpdate({
                  target: [
                    cultivatorEquipmentSlots.cultivatorId,
                    cultivatorEquipmentSlots.slot,
                  ],
                  set: { equipmentInstanceId: item.id },
                });
            } else
              await tx
                .delete(cultivatorEquipmentSlots)
                .where(
                  and(
                    eq(cultivatorEquipmentSlots.cultivatorId, owner),
                    eq(cultivatorEquipmentSlots.equipmentInstanceId, item.id),
                  ),
                );
            item.revision++;
            const loadout = await readCharacterEquipment(owner, tx);
            const character = await readBeastOwner(owner, tx);
            const compiled = compileDaoEquipmentSpecialLoadoutV1(
              loadout,
              character.ownerLevel,
            );
            if (!compiled.ok)
              throw new InventoryError(
                compiled.diagnostics.find((d) => d.severity === 'error')
                  ?.message ?? '装配无效',
              );
            await new ResourceEventCommitter().commit(tx, {
              actor: { userId: character.userId, cultivatorId: owner },
              source: 'inventory-equipment',
              scopeDefaults: { cultivatorId: owner },
              changes: [
                {
                  resourceTopic: 'player.profile',
                  operation: 'invalidate',
                  eventType: 'combat_v6.equipment.changed',
                },
              ],
            });
          }
        }
        await saveInventoryPlan(owner, before, next, tx);
        lease.assertHeld();
        return result;
      }),
  );
}
