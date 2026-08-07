import { db } from '@server/lib/drizzle/db';
import { battleReplayArchives } from '@server/lib/drizzle/schema';
import type { BattleReplayV1 } from '@shared/contracts/battleReplay';

/** Idempotent final archive write; duplicate JetStream delivery is expected. */
export async function archiveBattleReplay(replay: BattleReplayV1): Promise<void> {
  await db
    .insert(battleReplayArchives)
    .values({
      matchId: replay.matchId,
      replayVersion: replay.version,
      engineVersion: replay.engineVersion,
      rulesetVersion: replay.rulesetVersion,
      startedAt: new Date(replay.startedAt),
      finishedAt: new Date(replay.finishedAt),
      outcome: replay.outcome,
      participants: replay.participants,
      replay,
    })
    .onConflictDoNothing({ target: battleReplayArchives.matchId });
}
