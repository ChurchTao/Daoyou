import { ConflictException } from '@nestjs/common';
import {
  db,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import {
  invasionProgress,
  invasionRuns,
  invasionWeeks,
} from '@server/lib/drizzle/schema.js';
import { readParty } from '@server/parties/party.service.js';
import { and, asc, eq } from 'drizzle-orm';

export type InvasionRun = typeof invasionRuns.$inferSelect;
export type InvasionProgress = typeof invasionProgress.$inferSelect;

export async function invasionClosesAt(
  week: string,
  executor: DbExecutor = db,
) {
  const [period] = await executor
    .select({ closesAt: invasionWeeks.closesAt })
    .from(invasionWeeks)
    .where(eq(invasionWeeks.week, week));
  if (!period) throw new Error(`Missing invasion period ${week}`);
  return period.closesAt.getTime();
}

export const progressKey = (week: string, userId: string) =>
  and(eq(invasionProgress.week, week), eq(invasionProgress.userId, userId));

export function runProgress(runId: string, executor: DbExecutor = db) {
  return executor
    .select()
    .from(invasionProgress)
    .where(eq(invasionProgress.activeRunId, runId))
    .orderBy(asc(invasionProgress.userId));
}

export async function invasionRosterMatches(
  run: InvasionRun,
  executor: DbExecutor = db,
) {
  const party = await readParty(run.partyId, executor);
  return party?.revision === run.partyRevision;
}

// Callers hold the run row lock before releasing its occupied accounts.
export async function finishInvasionRun(tx: DbTransaction, runId: string) {
  await tx
    .update(invasionRuns)
    .set({
      phase: 'finished',
      dueAt: null,
      battleId: null,
      ready: [],
      selectedCards: {},
    })
    .where(eq(invasionRuns.id, runId));
  await tx
    .update(invasionProgress)
    .set({ activeRunId: null })
    .where(eq(invasionProgress.activeRunId, runId));
}

export async function consumeInvasionCards(
  tx: DbTransaction,
  run: InvasionRun,
  progress: InvasionProgress[],
) {
  for (const member of progress) {
    const card = run.selectedCards[member.cultivatorId];
    if (!card) continue;
    const count = member.cards[card] ?? 0;
    if (count < 1) throw new ConflictException('手中没有这张增益卡');
    member.cards = { ...member.cards, [card]: count - 1 };
    await tx
      .update(invasionProgress)
      .set({ cards: member.cards })
      .where(progressKey(member.week, member.userId));
  }
}
