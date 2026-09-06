import { db, type DbExecutor } from '@server/lib/drizzle/db';
import {
  combatV6ReplayArchives,
  combatV6ReplayParticipants,
} from '@server/lib/drizzle/schema';
import type { CombatV6ReplayV1 } from '@shared/contracts/combatV6Runtime';
import { and, eq } from 'drizzle-orm';

async function archive(
  values: typeof combatV6ReplayArchives.$inferInsert,
  participantIds: string[],
  executor: DbExecutor,
) {
  await executor.transaction(async (tx) => {
    await tx
      .insert(combatV6ReplayArchives)
      .values(values)
      .onConflictDoNothing();
    const existing = await tx.query.combatV6ReplayArchives.findFirst({
      columns: { battleId: true },
      where: and(
        eq(combatV6ReplayArchives.sourceType, values.sourceType),
        eq(combatV6ReplayArchives.idempotencyKey, values.idempotencyKey),
      ),
    });
    if (existing?.battleId !== values.battleId)
      throw new CombatV6ReplayConflictError(
        values.sourceType,
        values.idempotencyKey,
      );
    await tx
      .insert(combatV6ReplayParticipants)
      .values(
        [...new Set(participantIds)].map((cultivatorId) => ({
          battleId: values.battleId,
          cultivatorId,
        })),
      )
      .onConflictDoNothing();
  });
}

export async function archiveCombatV6Replay(
  replay: CombatV6ReplayV1,
  executor: DbExecutor = db,
): Promise<void> {
  await archive(
    {
      battleId: replay.battleId,
      metadataVersion: replay.metadata.schemaVersion,
      sourceType: replay.metadata.sourceType,
      battleType: replay.metadata.battleType,
      idempotencyKey: replay.metadata.idempotencyKey,
      engineVersion: replay.combatVersions.engineVersion,
      rulesetVersion: replay.combatVersions.rulesetVersion,
      startedAt: new Date(replay.startedAt),
      finishedAt: new Date(replay.finishedAt),
      outcome: replay.outcome,
      replay,
    },
    replay.participants.map((p) => p.cultivatorId),
    executor,
  );
}

export class CombatV6ReplayConflictError extends Error {
  constructor(
    readonly sourceType: string,
    readonly idempotencyKey: string,
  ) {
    super(
      `combat-v6 replay idempotency conflict: ${sourceType}/${idempotencyKey}`,
    );
    this.name = 'CombatV6ReplayConflictError';
  }
}

export async function findOwnedCombatV6Replay(
  battleId: string,
  cultivatorId: string,
  executor: DbExecutor = db,
) {
  const [row] = await executor
    .select({ archive: combatV6ReplayArchives })
    .from(combatV6ReplayArchives)
    .innerJoin(
      combatV6ReplayParticipants,
      eq(combatV6ReplayParticipants.battleId, combatV6ReplayArchives.battleId),
    )
    .where(
      and(
        eq(combatV6ReplayArchives.battleId, battleId),
        eq(combatV6ReplayParticipants.cultivatorId, cultivatorId),
      ),
    )
    .limit(1);
  return row?.archive;
}
