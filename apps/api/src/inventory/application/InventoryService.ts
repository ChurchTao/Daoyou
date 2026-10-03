import { recordJournalItems } from '@server/player/application/JournalSettlement.js';
import type {
  InventoryAction,
  InventoryQuerySchema,
  InventoryView,
} from '@daoyou/shared/contracts/inventory';
import { previewBeastFeeding } from '@daoyou/shared/engine/combat-v6/beasts/feeding';
import { refineBeast } from '@daoyou/shared/engine/combat-v6/beasts/refinement';
import { BEAST_REFINEMENT } from '@daoyou/shared/engine/combat-v6/beasts/refinement-config';
import { rejuvenateBeast } from '@daoyou/shared/engine/combat-v6/beasts/rejuvenation';
import {
  compileDaoEquipmentSpecialLoadoutV1,
  type DaoEquipmentInstanceV1,
} from '@daoyou/shared/engine/combat-v6/equipment';
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
} from '@daoyou/shared/inventory';
import { changeEquipmentLocation } from '@daoyou/shared/inventory/equipment-location';
import { INVENTORY_KINDS } from '@daoyou/shared/inventory/sorting';
import { BEAST_REJUVENATION } from '@daoyou/shared/items/definitions/beast-rejuvenation';
import { ConsumableFactsSchema } from '@daoyou/shared/items/definitions/consumables';
import { MaterialFactsSchema } from '@daoyou/shared/items/definitions/materials';
import { SeedFactsSchema } from '@daoyou/shared/items/definitions/seeds';
import { ITEM_DEFINITIONS } from '@daoyou/shared/items/registry';
import { QUALITY_VALUES } from '@daoyou/shared/types/constants';
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
} from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import {
  db,
  runDbTasks,
  type DbClient,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import {
  cultivatorBeasts,
  cultivatorEquipmentSlots,
  inventoryItems,
} from '@server/lib/drizzle/schema.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import {
  beastIndividualData,
  readBeastOwner,
  readBeastRoster,
} from '@server/lib/repositories/combatV6BeastRepository.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import { hasActiveCombat } from '@server/combat/application/CombatOccupancy.js';
import { inventoryStackKey } from '@server/inventory/application/inventoryStackKey.js';
import { publishResourceEvents } from '@server/realtime/infrastructure/playerStateBroadcaster.js';
import {
  ResourceEventCommitter,
  type ResourceCommitResult,
} from '@server/player/application/state/ResourceEventCommitter.js';

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
export async function assertInventoryIdle(owner: string, tx: DbExecutor = db) {
  if (await hasActiveCombat(owner, { executor: tx }))
    throw new InventoryError('请先结束战斗与结算，再调整物品');
}
export async function readInventory(
  owner: string,
  query: z.infer<typeof InventoryQuerySchema>,
  executor: DbExecutor = db,
): Promise<InventoryView> {
  const ownerFilter = eq(inventoryItems.cultivatorId, owner);
  const matches = ITEM_DEFINITIONS.filter((i) =>
    i.name.includes(query.search),
  ).map((i) => i.id);
  const materialRanks = QUALITY_VALUES.slice(
    query.minRank ? QUALITY_VALUES.indexOf(query.minRank) : 0,
    query.maxRank ? QUALITY_VALUES.indexOf(query.maxRank) + 1 : undefined,
  );
  const recycleKinds =
    query.recycleCategory === 'all'
      ? [
          'material',
          'seed',
          'equipment',
          'blueprint',
          'manual_jade',
          'consumable',
        ]
      : query.recycleCategory === 'pill' || query.recycleCategory === 'fruit'
        ? ['consumable']
        : query.recycleCategory
          ? [query.recycleCategory]
          : [];
  const recycleRanks = QUALITY_VALUES.slice(
    query.recycleMinQuality
      ? QUALITY_VALUES.indexOf(query.recycleMinQuality)
      : 0,
    query.recycleMaxQuality
      ? QUALITY_VALUES.indexOf(query.recycleMaxQuality) + 1
      : undefined,
  );
  const recycleQuality = sql<string>`case
    when ${inventoryItems.definitionId} = 'material.v1' then ${inventoryItems.instanceData}->>'rank'
    when ${inventoryItems.definitionId} = 'seed.v1' then ${inventoryItems.instanceData}->'seedSpec'->'plant'->>'quality'
    when ${inventoryItems.definitionId} = 'consumable.v1' then ${inventoryItems.instanceData}->>'quality'
    else null end`;
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
    query.kind === 'material' && (query.minRank || query.maxRank)
      ? inArray(
          sql<string>`${inventoryItems.instanceData}->>'rank'`,
          materialRanks,
        )
      : undefined,
    (query.kind === 'material' || query.recycleCategory === 'material') &&
      query.materialType
      ? eq(
          sql<string>`${inventoryItems.instanceData}->>'type'`,
          query.materialType,
        )
      : undefined,
    query.kind === 'material' && query.element
      ? eq(
          sql<string>`${inventoryItems.instanceData}->>'element'`,
          query.element,
        )
      : undefined,
    query.recycleCategory
      ? inArray(
          inventoryItems.definitionId,
          ITEM_DEFINITIONS.filter((item) =>
            recycleKinds.includes(item.kind),
          ).map((item) => item.id),
        )
      : undefined,
    query.recycleCategory === 'pill' || query.recycleCategory === 'fruit'
      ? eq(
          sql<string>`${inventoryItems.instanceData}->'spec'->>'kind'`,
          query.recycleCategory === 'pill' ? 'pill' : 'spirit_fruit',
        )
      : query.recycleCategory
        ? or(
            sql`${inventoryItems.definitionId} <> 'consumable.v1'`,
            inArray(
              sql<string>`${inventoryItems.instanceData}->'spec'->>'kind'`,
              ['pill', 'spirit_fruit'],
            ),
          )
        : undefined,
    query.recycleCategory &&
      (query.recycleMinQuality || query.recycleMaxQuality)
      ? inArray(recycleQuality, recycleRanks)
      : undefined,
  );
  const recentOrder = [desc(inventoryItems.updatedAt), desc(inventoryItems.id)];
  const kindOrder = sql`case ${sql.join(
    INVENTORY_KINDS.filter(([kind]) => kind !== 'all').map(([kind], index) =>
      sql`when ${inArray(
        inventoryItems.definitionId,
        ITEM_DEFINITIONS.filter((item) => item.kind === kind).map((item) => item.id),
      )} then ${index}`,
    ),
    sql` `,
  )} end`;
  const order =
    query.sort === 'quantity'
      ? [desc(inventoryItems.quantity), ...recentOrder]
      : query.sort === 'kind'
        ? [asc(kindOrder), ...recentOrder]
        : query.sort === 'updatedAt' || query.location === 'storage'
          ? recentOrder
          : [asc(inventoryItems.slotIndex), asc(inventoryItems.id)];
  const [requestedRows, totals, usage] = await runDbTasks(executor, [
    () =>
      executor
        .select()
        .from(inventoryItems)
        .where(filter)
        .orderBy(...order)
        .limit(query.location === 'bag' ? BAG_CAPACITY : 40)
        .offset(query.location === 'bag' ? 0 : query.page * 40),
    () =>
      executor.select({ value: count() }).from(inventoryItems).where(filter),
    () =>
      executor
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
      : await executor
          .select()
          .from(inventoryItems)
          .where(filter)
          .orderBy(...order)
          .limit(40)
          .offset(page * 40);
  const equipped =
    query.location === 'bag'
      ? await executor
          .select()
          .from(inventoryItems)
          .where(and(ownerFilter, eq(inventoryItems.location, 'equipped')))
          .orderBy(asc(inventoryItems.id))
      : [];
  return {
    items: rows.map((row) => ({
      ...inventoryItemOf(row),
      updatedAt: row.updatedAt.toISOString(),
      name:
        row.definitionId === 'equipment.v6' ||
        row.definitionId === 'material.v1' ||
        row.definitionId === 'seed.v1' ||
        row.definitionId === 'consumable.v1'
          ? (row.instanceData as DaoEquipmentInstanceV1).name
          : itemDefinition(row.definitionId).name,
      equipped: false,
    })),
    equippedItems: equipped.map((row) => ({
      ...inventoryItemOf(row),
      updatedAt: row.updatedAt.toISOString(),
      name: (row.instanceData as DaoEquipmentInstanceV1).name,
      equipped: true,
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
  recordJournalItems(tx, owner, before, after);
}
export async function grantInventory(
  owner: string,
  grants: ItemGrant[],
  tx: DbTransaction,
  overflow = true,
) {
  if (!grants.length) return [];
  // Only relevant stacks and the bounded bag are needed, even with an unlimited store.
  const rows = (
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
  );
  // Unrelated legacy definitions still occupy slots, but need not be decoded to grant items.
  const reservedSlots = rows.flatMap((row) =>
    row.location === 'bag' && row.slotIndex !== null ? [row.slotIndex] : [],
  );
  const before = rows
    .filter((row) =>
      grants.some((grant) =>
        row.definitionId === grant.definitionId &&
        row.stackKey !== null &&
        row.stackKey === inventoryStackKey(grant.definitionId, grant.instanceData) &&
        row.quantity < itemDefinition(grant.definitionId).stackLimit,
      ),
    )
    .map(inventoryItemOf);
  let next = before;
  for (const grant of grants)
    next = addItems(
      next,
      grant,
      'bag',
      overflow,
      randomUUID,
      inventoryStackKey(grant.definitionId, grant.instanceData),
      reservedSlots,
    );
  await saveInventoryPlan(owner, before, next, tx);
  return next.filter(
    (item): item is InventoryItem & { location: 'bag' | 'storage' } =>
      item.location !== 'equipped' &&
      item.quantity >
        (before.find((previous) => previous.id === item.id)?.quantity ?? 0),
  );
}
function transferInventoryItem(
  items: InventoryItem[],
  item: InventoryItem,
  location: 'bag' | 'storage',
) {
  if (item.location === location) throw new InventoryError('物品已在该位置');
  const next = items
    .filter((entry) => entry.id !== item.id)
    .map((entry) =>
      item.definitionId === 'consumable.v1'
        ? normalizeConsumableStack(entry)
        : entry,
    );
  if (itemDefinition(item.definitionId).stackLimit > 1)
    return addItems(
      next,
      {
        definitionId: item.definitionId,
        quantity: item.quantity,
        ...(item.definitionId === 'seed.v1'
          ? { instanceData: SeedFactsSchema.parse(item.instanceData) }
          : item.definitionId === 'material.v1'
            ? { instanceData: MaterialFactsSchema.parse(item.instanceData) }
            : item.definitionId === 'consumable.v1'
              ? { instanceData: ConsumableFactsSchema.parse(item.instanceData) }
              : {}),
      },
      location,
      false,
      () => item.id,
      item.definitionId === 'consumable.v1'
        ? inventoryStackKey(item.definitionId, item.instanceData)
        : item.stackKey,
    ).map((entry) =>
      entry.id === item.id ? { ...entry, revision: item.revision + 1 } : entry,
    );
  const slotIndex = location === 'bag' ? emptySlot(next) : null;
  if (location === 'bag' && slotIndex === null)
    throw new InventoryError('背包格子不足');
  return [
    ...next,
    { ...item, location, slotIndex, revision: item.revision + 1 },
  ];
}

function normalizeConsumableStack(item: InventoryItem): InventoryItem {
  if (item.definitionId !== 'consumable.v1') return item;
  const stackKey = inventoryStackKey(item.definitionId, item.instanceData);
  return stackKey === item.stackKey
    ? item
    : { ...item, stackKey, revision: item.revision + 1 };
}

export async function mutateInventory(owner: string, input: InventoryAction, database: DbClient = db) {
  const committed = await withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(owner),
      context: 'inventory',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) =>
      database.transaction(async (tx) => {
        await lockCultivatorForStateMutation(tx, owner);
        await assertInventoryIdle(owner, tx);
        if (input.action === 'transfer_many') {
          const ids = input.items.map((item) => item.id);
          const sourceLocation = input.location === 'bag' ? 'storage' : 'bag';
          const rows = await tx
            .select()
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.cultivatorId, owner),
                or(
                  eq(inventoryItems.location, 'bag'),
                  inArray(inventoryItems.id, ids),
                ),
              ),
            );
          const sources = input.items.map((ref) => {
            const row = rows.find((item) => item.id === ref.id);
            if (
              !row ||
              row.revision !== ref.revision ||
              row.location !== sourceLocation
            )
              throw new InventoryError('物品已变化，请刷新后重试');
            return inventoryItemOf(row);
          });
          const equipped = await tx
            .select({ id: cultivatorEquipmentSlots.equipmentInstanceId })
            .from(cultivatorEquipmentSlots)
            .where(
              and(
                eq(cultivatorEquipmentSlots.cultivatorId, owner),
                inArray(cultivatorEquipmentSlots.equipmentInstanceId, ids),
              ),
            );
          if (equipped.length) throw new InventoryError('请先卸下装备');
          const stackFilters = sources.flatMap((item) =>
            item.stackKey
              ? [and(
                  eq(inventoryItems.definitionId, item.definitionId),
                  eq(
                    inventoryItems.stackKey,
                    item.definitionId === 'consumable.v1'
                      ? inventoryStackKey(item.definitionId, item.instanceData)!
                      : item.stackKey,
                  ),
                  sql`${inventoryItems.quantity} < ${itemDefinition(item.definitionId).stackLimit}`,
                )]
              : [],
          );
          const targets =
            input.location === 'storage' && stackFilters.length
              ? await tx
                  .select()
                  .from(inventoryItems)
                  .where(
                    and(
                      eq(inventoryItems.cultivatorId, owner),
                      eq(inventoryItems.location, 'storage'),
                      or(...stackFilters),
                    ),
                  )
              : [];
          const before = [
            ...new Map(
              [...rows, ...targets].map((row) => [
                row.id,
                inventoryItemOf(row),
              ]),
            ).values(),
          ];
          let next = before.map((item) => ({ ...item }));
          for (const source of sources) {
            const item = next.find((entry) => entry.id === source.id)!;
            next = transferInventoryItem(next, item, input.location);
          }
          await saveInventoryPlan(owner, before, next, tx);
          const state = await new ResourceEventCommitter().commit(tx, {
            actor: { cultivatorId: owner },
            source: 'inventory-transfer-many',
            scopeDefaults: { cultivatorId: owner },
            changes: [
              {
                resourceTopic: 'inventory.bag',
                operation: 'invalidate',
                eventType: 'inventory.bag.changed',
              },
            ],
          });
          lease.assertHeld();
          return { data: { transferred: ids.length }, state };
        }
        const before = (
          await tx
            .select()
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.cultivatorId, owner),
                or(
                  eq(inventoryItems.location, 'bag'),
                  input.action === 'equip'
                    ? eq(inventoryItems.location, 'equipped')
                    : undefined,
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
                  eq(
                    inventoryItems.stackKey,
                    source.definitionId === 'consumable.v1'
                      ? inventoryStackKey(source.definitionId, source.instanceData)!
                      : source.stackKey ?? '',
                  ),
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
        let result: {
          gained?: number;
          wasted?: number;
          level?: number;
          oldSkill?: string;
          newSkill?: string;
          oldSkillCount?: number;
          newSkillCount?: number;
        } = {};
        let state: ResourceCommitResult = { changes: [], baselines: [] };
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
          next = sortBag(next.map(normalizeConsumableStack));
        } else if (item) {
          const equipped = await tx
            .select()
            .from(cultivatorEquipmentSlots)
            .where(eq(cultivatorEquipmentSlots.equipmentInstanceId, item.id));
          if (input.action === 'transfer') {
            if (equipped.length) throw new InventoryError('请先卸下装备');
            next = transferInventoryItem(next, item, input.location);
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
              return { data: result, state };
            }
            if (target && item.definitionId === 'consumable.v1') {
              const normalizedItem = normalizeConsumableStack(item);
              const normalizedTarget = normalizeConsumableStack(target);
              item.stackKey = normalizedItem.stackKey;
              target.stackKey = normalizedTarget.stackKey;
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
          } else if (input.action === 'learn') {
            if (item.location !== 'bag' && item.location !== 'storage')
              throw new InventoryError('请选择储物袋或储藏室中的传承灵印');
            const roster = await readBeastRoster(owner, tx);
            const beast = roster.beasts.find(
              (b) =>
                b.id === input.beastId && b.revision === input.beastRevision,
            );
            if (!beast) throw new InventoryError('灵兽已有变化，请重新查看');
            const slot = beast.skillSlotCapacity
              ? randomInt(beast.skillSlotCapacity)
              : 0;
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
          } else if (input.action === 'feed') {
            if (
              item.definitionId !== 'consumable.v1' ||
              (item.location !== 'bag' && item.location !== 'storage') ||
              item.quantity < input.quantity
            )
              throw new InventoryError(
                '请选择储物袋或储藏室中足量的丹药或灵果',
              );
            const facts = ConsumableFactsSchema.parse(item.instanceData);
            const roster = await readBeastRoster(owner, tx);
            const beast = roster.beasts.find(
              (b) =>
                b.id === input.beastId && b.revision === input.beastRevision,
            );
            if (!beast) throw new InventoryError('灵兽已有变化，请重新查看');
            let fed;
            try {
              fed = previewBeastFeeding(
                beast,
                facts.spec,
                input.quantity,
                roster.ownerLevel,
              );
            } catch (error) {
              throw new InventoryError(
                error instanceof Error ? error.message : '喂养无效',
              );
            }
            await tx
              .update(cultivatorBeasts)
              .set({ individual: beastIndividualData(fed.beast) })
              .where(
                and(
                  eq(cultivatorBeasts.id, beast.id),
                  eq(cultivatorBeasts.cultivatorId, owner),
                ),
              );
            result = {
              gained: fed.gained,
              wasted: fed.wasted,
              level: fed.beast.level,
            };
            item.quantity -= input.quantity;
            item.revision++;
            if (!item.quantity) next = next.filter((i) => i.id !== item.id);
          } else if (input.action === 'refine') {
            const dew = BEAST_REFINEMENT.items.find(
              (entry) => entry.id === item.definitionId,
            );
            if (
              !dew ||
              (item.location !== 'bag' && item.location !== 'storage') ||
              item.quantity < dew.consumeQuantity
            )
              throw new InventoryError('请选择储物袋或储藏室中足量的归元灵露');
            const roster = await readBeastRoster(owner, tx);
            const beast = roster.beasts.find(
              (b) =>
                b.id === input.beastId && b.revision === input.beastRevision,
            );
            if (!beast) throw new InventoryError('灵兽已有变化，请重新查看');
            const refined = refineBeast(
              beast,
              item.definitionId,
              roster.ownerLevel,
              randomInt(0, 0x7fffffff),
            );
            await tx
              .update(cultivatorBeasts)
              .set({ individual: beastIndividualData(refined) })
              .where(
                and(
                  eq(cultivatorBeasts.id, beast.id),
                  eq(cultivatorBeasts.cultivatorId, owner),
                ),
              );
            result = {
              oldSkillCount: beast.skills.length,
              newSkillCount: refined.skills.length,
            };
            item.quantity -= dew.consumeQuantity;
            item.revision++;
            if (!item.quantity) next = next.filter((i) => i.id !== item.id);
          } else if (input.action === 'rejuvenate') {
            if (
              item.definitionId !== BEAST_REJUVENATION.id ||
              (item.location !== 'bag' && item.location !== 'storage') ||
              item.quantity < 1
            )
              throw new InventoryError('请选择储物袋或储藏室中的化生果');
            const roster = await readBeastRoster(owner, tx);
            const beast = roster.beasts.find(
              (b) =>
                b.id === input.beastId && b.revision === input.beastRevision,
            );
            if (!beast) throw new InventoryError('灵兽已有变化，请重新查看');
            if (
              !beast.level &&
              !beast.exp &&
              Object.values(beast.allocatedAttributes).every(
                (point) => point === 0,
              )
            )
              throw new InventoryError('灵兽已是初生状态');
            const rejuvenated = rejuvenateBeast(beast);
            await tx
              .update(cultivatorBeasts)
              .set({ individual: beastIndividualData(rejuvenated) })
              .where(
                and(
                  eq(cultivatorBeasts.id, beast.id),
                  eq(cultivatorBeasts.cultivatorId, owner),
                ),
              );
            result = { level: rejuvenated.level };
            item.quantity--;
            item.revision++;
            if (!item.quantity) next = next.filter((i) => i.id !== item.id);
          } else if (input.action === 'equip') {
            if (
              item.location !== (input.equipped ? 'bag' : 'equipped') ||
              item.definitionId !== 'equipment.v6'
            )
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
            next = changeEquipmentLocation(
              next,
              item.id,
              input.equipped,
              previous?.equipmentInstanceId,
            );
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
            const loadout = Object.fromEntries(
              next
                .filter((entry) => entry.location === 'equipped')
                .map((entry) => {
                  const facts = entry.instanceData as DaoEquipmentInstanceV1;
                  return [facts.slot, facts];
                }),
            );
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
            await saveInventoryPlan(owner, before, next, tx);
            state = await new ResourceEventCommitter().commit(tx, {
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
        if (input.action !== 'equip')
          await saveInventoryPlan(owner, before, next, tx);
        if (!state.changes.length) {
          state = await new ResourceEventCommitter().commit(tx, {
            actor: { cultivatorId: owner },
            source: `inventory-${input.action}`,
            scopeDefaults: { cultivatorId: owner },
            changes: [
              {
                resourceTopic: 'inventory.bag',
                operation: 'invalidate',
                eventType: 'inventory.bag.changed',
              },
            ],
          });
        }
        lease.assertHeld();
        return { data: result, state };
      }),
  );
  publishResourceEvents(committed.state.changes);
  return committed;
}
