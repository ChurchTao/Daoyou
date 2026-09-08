/** Maintenance command: default read-only inventory; --apply requires explicit record IDs. */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../src/server/lib/drizzle/db';
import { sectTaskRecords } from '../src/server/lib/drizzle/schema';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const ids = args
  .filter((arg) => arg !== '--apply' && arg !== '--dry-run')
  .map((arg) => z.uuid().parse(arg));
if (apply && !ids.length)
  throw new Error('--apply 必须明确列出已经核对的任务记录 UUID');
const legacy = and(
  eq(sectTaskRecords.status, 'active'),
  sql`${sectTaskRecords.payload}->'offer'->>'executorKey' = 'sect.battle'`,
  sql`${sectTaskRecords.payload}->'executorData'->'battleTarget' ? 'combatant'`,
  sql`${sectTaskRecords.payload}->'executorData'->>'activeBattleId' IS NULL`,
  ids.length ? inArray(sectTaskRecords.id, ids) : undefined,
);
const inventory = await db
  .select({
    id: sectTaskRecords.id,
    membershipId: sectTaskRecords.membershipId,
    taskId: sectTaskRecords.taskId,
    periodKey: sectTaskRecords.periodKey,
    attempt: sectTaskRecords.attempt,
    status: sectTaskRecords.status,
  })
  .from(sectTaskRecords)
  .where(legacy);
console.log(
  JSON.stringify(
    {
      mode: apply ? 'apply' : 'dry-run',
      count: inventory.length,
      accounting:
        '现有领取额度由同成员/周期/任务的非 abandoned 记录占用；撤销即释放该记录占用，不存在独立额度计数或领取货币扣款，不额外发资源。',
      records: inventory,
    },
    null,
    2,
  ),
);
if (apply) {
  const changed = await db.transaction(async (tx) =>
    tx
      .update(sectTaskRecords)
      .set({ status: 'abandoned', updatedAt: new Date() })
      .where(legacy)
      .returning({ id: sectTaskRecords.id }),
  );
  console.log(JSON.stringify({ cancelled: changed.length, records: changed }));
}
process.exit(0);
