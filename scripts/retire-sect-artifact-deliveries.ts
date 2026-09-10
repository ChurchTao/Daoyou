/** Offline maintenance only. No conversion of old requirements into new equipment rules. */
import { and, inArray, sql } from 'drizzle-orm';
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
  sql`${sectTaskRecords.payload}->'offer'->'requirement'->>'kind' = 'artifact'`,
  ids.length ? inArray(sectTaskRecords.id, ids) : undefined,
);
const records = await db
  .select({
    id: sectTaskRecords.id,
    membershipId: sectTaskRecords.membershipId,
    taskId: sectTaskRecords.taskId,
    periodKey: sectTaskRecords.periodKey,
    status: sectTaskRecords.status,
    payload: sectTaskRecords.payload,
  })
  .from(sectTaskRecords)
  .where(legacy);
console.log(
  JSON.stringify(
    {
      mode: apply ? 'apply' : 'dry-run',
      count: records.length,
      accounting:
        'active 改 abandoned 释放其领取次数；其他状态、奖励快照、交付记录不变。全部移除旧 offer.requirement；保留盘点输出作为维护记录。',
      records,
    },
    null,
    2,
  ),
);
if (apply) {
  const changed = await db.transaction((tx) =>
    tx
      .update(sectTaskRecords)
      .set({
        status: sql`CASE WHEN ${sectTaskRecords.status} = 'active' THEN 'abandoned' ELSE ${sectTaskRecords.status} END`,
        payload: sql`jsonb_set(${sectTaskRecords.payload} #- '{offer,requirement}', '{offer,executorKey}', '"sect.delivery.equipment"'::jsonb)`,
        updatedAt: new Date(),
      })
      .where(legacy)
      .returning({ id: sectTaskRecords.id, status: sectTaskRecords.status }),
  );
  console.log(JSON.stringify({ updated: changed.length, records: changed }));
}
process.exit(0);
