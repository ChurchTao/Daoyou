/** One-time character maintenance. Dry-run by default; never exposed to players. */
import { and, asc, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
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
const owner = z.uuid().parse(args[0]);
const apply = args.includes('--apply');
const expectedHash = args.find((arg) => arg.startsWith('--expect='))?.slice(9);
const backupPath = args.find((arg) => arg.startsWith('--backup='))?.slice(9);
if (
  args
    .slice(1)
    .some(
      (arg) =>
        arg !== '--apply' &&
        !arg.startsWith('--expect=') &&
        !arg.startsWith('--backup='),
    )
)
  throw new Error('参数无效');
if (apply && (!expectedHash || !backupPath || !isAbsolute(backupPath)))
  throw new Error(
    '--apply 需要 dry-run 输出的 --expect=<hash> 和绝对路径 --backup=<path>',
  );

const filter = and(
  eq(inventoryItems.cultivatorId, owner),
  eq(inventoryItems.location, 'storage'),
  eq(inventoryItems.definitionId, 'consumable.v1'),
  eq(sql<string>`${inventoryItems.instanceData}->'spec'->>'kind'`, 'pill'),
);

async function readPills(executor: DbExecutor) {
  return executor
    .select()
    .from(inventoryItems)
    .where(filter)
    .orderBy(asc(inventoryItems.id));
}

function plan(rows: Awaited<ReturnType<typeof readPills>>) {
  const hash = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  const before = rows.map(inventoryItemOf);
  const normalized = before.map((item): InventoryItem => {
    const stackKey = inventoryStackKey(item.definitionId, item.instanceData);
    return stackKey === item.stackKey
      ? item
      : { ...item, stackKey, revision: item.revision + 1 };
  });
  const after = compactStorage(normalized);
  const quantity = (items: InventoryItem[]) =>
    items.reduce((total, item) => total + item.quantity, 0);
  if (quantity(before) !== quantity(after))
    throw new Error('整理前后丹药数量不一致');
  return {
    hash,
    before,
    after,
    summary: {
      owner,
      hash,
      beforeStacks: before.length,
      afterStacks: after.length,
      removedStacks: before.length - after.length,
      quantity: quantity(before),
    },
  };
}

if (!apply) {
  const rows = await db.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    return readPills(tx);
  });
  console.log(
    JSON.stringify({ mode: 'dry-run', ...plan(rows).summary }, null, 2),
  );
} else {
  const committed = await withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(owner),
      context: 'pill-storage-maintenance',
      timeoutMs: 30_000,
      retries: 0,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        await lockCultivatorForStateMutation(tx, owner);
        await assertInventoryIdle(owner, tx);
        const rows = await readPills(tx);
        const { hash, before, after, summary } = plan(rows);
        if (hash !== expectedHash)
          throw new Error('库存已变化，请重新 dry-run');
        await writeFile(
          backupPath!,
          JSON.stringify({ owner, hash, rows }, null, 2),
          {
            flag: 'wx',
            mode: 0o600,
          },
        );
        await saveInventoryPlan(owner, before, after, tx);
        if (
          before.length &&
          before.some(
            (item, index) =>
              JSON.stringify(item) !== JSON.stringify(after[index]),
          )
        )
          await new ResourceEventCommitter().commit(tx, {
            actor: { cultivatorId: owner },
            source: 'pill-storage-maintenance',
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
        return summary;
      }),
  );
  console.log(
    JSON.stringify({ mode: 'apply', ...committed, backupPath }, null, 2),
  );
}
process.exit(0);
