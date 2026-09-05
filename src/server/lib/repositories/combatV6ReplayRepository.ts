import { db, type DbExecutor } from '@server/lib/drizzle/db';
import { combatV6ReplayArchives } from '@server/lib/drizzle/schema';
import type { CombatV6ReplayV1 } from '@shared/contracts/combatV6Runtime';
import { and, eq } from 'drizzle-orm';

export async function archiveCombatV6Replay(replay: CombatV6ReplayV1, executor: DbExecutor = db): Promise<void> {
  const existing = await executor.query.combatV6ReplayArchives.findFirst({
    columns: { battleId: true },
    where: and(
      eq(combatV6ReplayArchives.sourceType, replay.metadata.sourceType),
      eq(combatV6ReplayArchives.idempotencyKey, replay.metadata.idempotencyKey),
    ),
  });
  if (existing) {
    if (existing.battleId === replay.battleId) return;
    throw new CombatV6ReplayConflictError(replay.metadata.sourceType, replay.metadata.idempotencyKey);
  }
  await executor.insert(combatV6ReplayArchives).values({
    battleId: replay.battleId, cultivatorId: replay.cultivatorId,
    metadataVersion: replay.metadata.schemaVersion, sourceType: replay.metadata.sourceType,
    battleType: replay.metadata.battleType, idempotencyKey: replay.metadata.idempotencyKey,
    engineVersion: replay.combatVersions.engineVersion, rulesetVersion: replay.combatVersions.rulesetVersion,
    startedAt: new Date(replay.startedAt), finishedAt: new Date(replay.finishedAt), outcome: replay.outcome, replay,
  }).onConflictDoNothing({ target: combatV6ReplayArchives.battleId });
}

export class CombatV6ReplayConflictError extends Error {
  constructor(readonly sourceType: string, readonly idempotencyKey: string) {
    super(`combat-v6 replay idempotency conflict: ${sourceType}/${idempotencyKey}`);
    this.name = 'CombatV6ReplayConflictError';
  }
}

export async function findOwnedCombatV6Replay(battleId: string, cultivatorId: string, executor: DbExecutor = db) {
  return executor.query.combatV6ReplayArchives.findFirst({
    where: and(eq(combatV6ReplayArchives.battleId, battleId), eq(combatV6ReplayArchives.cultivatorId, cultivatorId)),
  });
}
