import { db, getExecutor } from '@server/lib/drizzle/db';
import {
  accountDeletionRecords,
  cultivators,
} from '@server/lib/drizzle/schema';
import { eq } from 'drizzle-orm';

export async function recordPendingAccountDeletion(
  userId: string,
): Promise<void> {
  const requestedAt = new Date();

  await db().transaction(async (tx) => {
    const rows = await tx
      .select({ id: cultivators.id })
      .from(cultivators)
      .where(eq(cultivators.userId, userId));
    const cultivatorIds = rows.map((row) => row.id);

    await tx
      .insert(accountDeletionRecords)
      .values({
        userId,
        cultivatorIds,
        status: 'pending',
        requestedAt,
        completedAt: null,
      })
      .onConflictDoUpdate({
        target: accountDeletionRecords.userId,
        set: {
          cultivatorIds,
          status: 'pending',
          requestedAt,
          completedAt: null,
        },
      });
  });
}

export async function markAccountDeletionCompleted(
  userId: string,
): Promise<void> {
  await getExecutor()
    .update(accountDeletionRecords)
    .set({
      status: 'completed',
      completedAt: new Date(),
    })
    .where(eq(accountDeletionRecords.userId, userId));
}
