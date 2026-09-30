/** One-time pill inventory maintenance. Dry-run by default; never exposed to players. */
import { and, asc, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db, type DbExecutor } from '../src/server/lib/drizzle/db';
import { inventoryItems } from '../src/server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '../src/server/lib/redis/lock';
import { lockCultivatorForStateMutation } from '../src/server/lib/repositories/playerStateRepository';
import {
  assertInventoryIdle,
  inventoryItemOf,
  saveInventoryPlan,
} from '../src/server/lib/services/InventoryService';
import { inventoryStackKey } from '../src/server/lib/services/inventoryStackKey';
import { ResourceEventCommitter } from '../src/server/lib/services/ResourceEventCommitter';
import { compactStorage, type InventoryItem } from '../src/shared/inventory';

const args = process.argv.slice(2);
const all = args.includes('--all');
const apply = args.includes('--apply');
const expectedHash = args.find((arg) => arg.startsWith('--expect='))?.slice(9);
const owners = args.filter((arg) => !arg.startsWith('--'));
if (
  args.some(
    (arg) =>
      arg.startsWith('--') &&
      arg !== '--all' &&
      arg !== '--apply' &&
      !arg.startsWith('--expect='),
  )
)
  throw new Error('参数无效');
if ((all && owners.length) || (!all && owners.length !== 1))
  throw new Error('请指定一个角色 UUID，或使用 --all');
const selectedOwner = all ? null : z.uuid().parse(owners[0]);
if (apply && !expectedHash)
  throw new Error('--apply 需要 dry-run 输出的 --expect=<hash>');

const pillFilter = and(
  eq(inventoryItems.definitionId, 'consumable.v1'),
  eq(sql<string>`${inventoryItems.instanceData}->'spec'->>'kind'`, 'pill'),
  selectedOwner ? eq(inventoryItems.cultivatorId, selectedOwner) : undefined,
);

async function readPills(executor: DbExecutor, owner?: string) {
  return executor
    .select()
    .from(inventoryItems)
    .where(
      and(
        pillFilter,
        owner ? eq(inventoryItems.cultivatorId, owner) : undefined,
      ),
    )
    .orderBy(
      asc(inventoryItems.cultivatorId),
      asc(inventoryItems.location),
      asc(inventoryItems.slotIndex),
      asc(inventoryItems.id),
    );
}

type PillRows = Awaited<ReturnType<typeof readPills>>;

function sha(value: object): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function planOwner(rows: PillRows) {
  const hash = sha(rows);
  const before = rows.map(inventoryItemOf);
  const normalized = before.map((item): InventoryItem => {
    const stackKey = inventoryStackKey(item.definitionId, item.instanceData);
    return stackKey === item.stackKey
      ? item
      : { ...item, stackKey, revision: item.revision + 1 };
  });
  // Keep every bag slot in place; merge pills separately within each location.
  const after = [
    ...compactStorage(normalized.filter((item) => item.location === 'bag')),
    ...compactStorage(normalized.filter((item) => item.location === 'storage')),
  ];
  const quantity = (items: InventoryItem[]) =>
    items.reduce((total, item) => total + item.quantity, 0);
  if (quantity(before) !== quantity(after))
    throw new Error('重算前后丹药数量不一致');
  return {
    hash,
    before,
    after,
    summary: {
      owner: rows[0]?.cultivatorId,
      beforeBag: before.filter((item) => item.location === 'bag').length,
      afterBag: after.filter((item) => item.location === 'bag').length,
      beforeStorage: before.filter((item) => item.location === 'storage')
        .length,
      afterStorage: after.filter((item) => item.location === 'storage').length,
      quantity: quantity(before),
    },
  };
}

function planAll(rows: PillRows) {
  const grouped = new Map<string, PillRows>();
  for (const row of rows) {
    const group = grouped.get(row.cultivatorId) ?? [];
    group.push(row);
    grouped.set(row.cultivatorId, group);
  }
  const plans = [...grouped].map(([owner, ownerRows]) => ({
    owner,
    ...planOwner(ownerRows),
  }));
  const hash = sha(
    plans.map(({ owner, hash: ownerHash }) => [owner, ownerHash]),
  );
  const sum = (
    key:
      'beforeBag' | 'afterBag' | 'beforeStorage' | 'afterStorage' | 'quantity',
  ) => plans.reduce((total, entry) => total + entry.summary[key], 0);
  return {
    hash,
    plans,
    summary: {
      scope: all ? 'all' : selectedOwner,
      hash,
      characters: plans.length,
      beforeBag: sum('beforeBag'),
      afterBag: sum('afterBag'),
      beforeStorage: sum('beforeStorage'),
      afterStorage: sum('afterStorage'),
      quantity: sum('quantity'),
      changedCharacters: plans.filter(
        ({ before, after }) =>
          before.length !== after.length ||
          before.some(
            (item, index) =>
              JSON.stringify(item) !== JSON.stringify(after[index]),
          ),
      ).length,
    },
  };
}

async function readPlan() {
  const rows = await db.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    return readPills(tx);
  });
  return { rows, ...planAll(rows) };
}

if (!apply) {
  const { summary } = await readPlan();
  console.log(JSON.stringify({ mode: 'dry-run', ...summary }, null, 2));
} else {
  const { hash, plans, summary } = await readPlan();
  if (hash !== expectedHash) throw new Error('库存已变化，请重新 dry-run');
  let processed = 0;
  for (const expected of plans) {
    await withRedisLock(
      {
        key: redisLockKeys.cultivatorMutation(expected.owner),
        context: 'pill-inventory-maintenance',
        timeoutMs: 30_000,
        retries: 0,
      },
      async (lease) =>
        db.transaction(async (tx) => {
          await lockCultivatorForStateMutation(tx, expected.owner);
          await assertInventoryIdle(expected.owner, tx);
          const current = planOwner(await readPills(tx, expected.owner));
          if (current.hash !== expected.hash)
            throw new Error(
              `角色 ${expected.owner} 的库存已变化，请重新 dry-run`,
            );
          await saveInventoryPlan(
            expected.owner,
            current.before,
            current.after,
            tx,
          );
          if (
            current.before.length !== current.after.length ||
            current.before.some(
              (item, index) =>
                JSON.stringify(item) !== JSON.stringify(current.after[index]),
            )
          )
            await new ResourceEventCommitter().commit(tx, {
              actor: { cultivatorId: expected.owner },
              source: 'pill-inventory-maintenance',
              scopeDefaults: { cultivatorId: expected.owner },
              changes: [
                {
                  resourceTopic: 'inventory.bag',
                  operation: 'invalidate',
                  eventType: 'inventory.bag.changed',
                },
              ],
            });
          lease.assertHeld();
        }),
    );
    processed++;
    console.log(
      JSON.stringify({ processed, total: plans.length, owner: expected.owner }),
    );
  }
  const verified = await readPlan();
  if (
    verified.summary.quantity !== summary.quantity ||
    verified.summary.beforeBag !== summary.afterBag ||
    verified.summary.beforeStorage !== summary.afterStorage ||
    verified.summary.changedCharacters !== 0
  )
    throw new Error('写入完成，但回查与演算不一致');
  console.log(
    JSON.stringify({ mode: 'apply', ...summary, verified: true }, null, 2),
  );
}
process.exit(0);
