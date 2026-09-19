import { db, type DbExecutor } from '@server/lib/drizzle/db';
import {
  combatReplayArchives,
  combatReplayParticipants,
} from '@server/lib/drizzle/schema';
import {
  COMBAT_V6_REPLAY_SOURCES,
  type CombatV6HistoryPage,
  type CombatV6HistoryQuery,
} from '@shared/contracts/combatV6Replay';
import type { CombatV6ReplayV1 } from '@shared/contracts/combatV6Runtime';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';

async function archive(
  values: typeof combatReplayArchives.$inferInsert,
  participants: CombatV6ReplayV1['participants'],
  executor: DbExecutor,
) {
  await executor.transaction(async (tx) => {
    await tx
      .insert(combatReplayArchives)
      .values(values)
      .onConflictDoNothing();
    const existing = await tx.query.combatReplayArchives.findFirst({
      columns: { battleId: true },
      where: and(
        eq(combatReplayArchives.sourceType, values.sourceType),
        eq(combatReplayArchives.idempotencyKey, values.idempotencyKey),
      ),
    });
    if (existing?.battleId !== values.battleId)
      throw new CombatV6ReplayConflictError(
        values.sourceType,
        values.idempotencyKey,
      );
    if (!participants.length) return;
    await tx
      .insert(combatReplayParticipants)
      .values(
        participants.map(({ cultivatorId, side }) => ({
          battleId: values.battleId,
          cultivatorId,
          side,
        })),
      )
      .onConflictDoNothing();
  });
}

/** Keep idempotency receipts for PvE settlement, but only retain competitive replays. */
export async function archiveCombatV6Replay(
  replay: CombatV6ReplayV1,
  executor: DbExecutor = db,
): Promise<void> {
  const keepReplay = COMBAT_V6_REPLAY_SOURCES.some(
    (source) => source === replay.metadata.sourceType,
  );
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
      roundCount: replay.finalState.round,
      sides: [0, 1].map((side) =>
        replay.initialUnits.filter((u) => u.side === side).map((u) => u.name),
      ) as [string[], string[]],
      replay: keepReplay ? replay : null,
    },
    keepReplay ? replay.participants : [],
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

/** A lost short-lived request must not settle a new result over an existing archive. */
export async function combatV6ReplayExists(
  battleId: string,
  executor: DbExecutor = db,
) {
  const [row] = await executor
    .select({ battleId: combatReplayArchives.battleId })
    .from(combatReplayArchives)
    .where(eq(combatReplayArchives.battleId, battleId))
    .limit(1);
  return !!row;
}

export async function findOwnedCombatV6Replay(
  battleId: string,
  cultivatorId: string,
  executor: DbExecutor = db,
) {
  const [row] = await executor
    .select({ archive: combatReplayArchives })
    .from(combatReplayArchives)
    .innerJoin(
      combatReplayParticipants,
      eq(combatReplayParticipants.battleId, combatReplayArchives.battleId),
    )
    .where(
      and(
        eq(combatReplayArchives.battleId, battleId),
        inArray(combatReplayArchives.sourceType, [...COMBAT_V6_REPLAY_SOURCES]),
        isNotNull(combatReplayArchives.replay),
        eq(combatReplayParticipants.cultivatorId, cultivatorId),
      ),
    )
    .limit(1);
  return row?.archive;
}

/** Explicit metadata-only SELECT: do not fetch/decode replay JSONB on this path. */
export async function listOwnedCombatV6Replays(
  cultivatorId: string,
  query: CombatV6HistoryQuery,
  executor: DbExecutor = db,
): Promise<CombatV6HistoryPage> {
  const a = combatReplayArchives;
  const p = combatReplayParticipants;
  const pageSize = 10;
  const rows = await executor
    .select({
      battleId: a.battleId,
      sourceType: a.sourceType,
      finishedAt: a.finishedAt,
      roundCount: a.roundCount,
      sides: a.sides,
      outcome: a.outcome,
      side: p.side,
    })
    .from(p)
    .innerJoin(a, eq(p.battleId, a.battleId))
    .where(
      and(
        eq(p.cultivatorId, cultivatorId),
        inArray(a.sourceType, [...COMBAT_V6_REPLAY_SOURCES]),
        isNotNull(a.replay),
        query.source ? eq(a.sourceType, query.source) : undefined,
      ),
    )
    .orderBy(desc(a.finishedAt), desc(a.battleId))
    .limit(pageSize + 1)
    .offset((query.page - 1) * pageSize);
  return {
    page: query.page,
    hasMore: rows.length > pageSize,
    items: rows.slice(0, pageSize).map(({ side, ...row }) => ({
      ...row,
      finishedAt: row.finishedAt.toISOString(),
      sides: side === 1 ? [row.sides[1], row.sides[0]] : row.sides,
      outcome:
        row.outcome === 'draw' || row.outcome === 'aborted'
          ? row.outcome
          : row.outcome === `side-${side}`
            ? 'victory'
            : 'defeat',
    })),
  };
}
