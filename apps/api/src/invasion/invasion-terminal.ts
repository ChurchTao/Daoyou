import type { ArenaRuntime } from '@daoyou/contracts/combat/arena';
import type { ResourceChange } from '@daoyou/contracts/resources';
import {
  INVASION_REST_MS,
  invasionCardDrop,
  invasionFirstClear,
} from '@daoyou/game-rules/invasion';
import { settlePersistentBattle } from '@server/combat/application/CombatV6PersistentCondition.js';
import { db } from '@server/lib/drizzle/db.js';
import { invasionProgress, invasionRuns } from '@server/lib/drizzle/schema.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import { ResourceEventCommitter } from '@server/player/application/state/ResourceEventCommitter.js';
import { publishResourceEvents } from '@server/realtime/infrastructure/playerStateBroadcaster.js';
import { eq } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import {
  consumeInvasionCards,
  finishInvasionRun,
  invasionClosesAt,
  invasionRosterMatches,
  progressKey,
  runProgress,
} from './invasion-run.js';

export async function recordInvasionTerminal(runtime: ArenaRuntime) {
  const invasion = runtime.invasion!;
  const changes = await db.transaction(async (tx) => {
    for (const participant of [...runtime.participants].sort((a, b) =>
      a.cultivatorId.localeCompare(b.cultivatorId),
    )) {
      await lockCultivatorForStateMutation(tx, participant.cultivatorId);
    }
    const [run] = await tx
      .select()
      .from(invasionRuns)
      .where(eq(invasionRuns.id, invasion.teamId))
      .for('update');
    if (
      !run ||
      run.launchId !== runtime.startRequestId ||
      run.wave !== invasion.wave ||
      (run.battleId !== null && run.battleId !== runtime.battleId) ||
      !['launching', 'battle'].includes(run.phase)
    )
      return;
    const closesAt = await invasionClosesAt(run.week, tx);
    const endedAt = runtime.terminalAt ?? runtime.deadlineAt;
    const won = runtime.state.result?.winner === 0 && endedAt < closesAt;
    const changes: ResourceChange[] = [];
    for (const participant of runtime.participants) {
      if (runtime.terminalReason === 'battle-ended') {
        await settlePersistentBattle(
          tx,
          participant.cultivatorId,
          runtime.state,
          runtime.events,
          participant.unitId,
          runtime.units.find((unit) => unit.id === participant.unitId)?.attrs,
        );
      }
      const committed = await new ResourceEventCommitter().commit(tx, {
        actor: {
          userId: participant.userId,
          cultivatorId: participant.cultivatorId,
        },
        source: 'invasion.battle',
        scopeDefaults: { cultivatorId: participant.cultivatorId },
        changes: [
          {
            resourceTopic: 'player.condition',
            operation: 'invalidate',
            eventType: 'condition.invasion.settled',
          },
        ],
      });
      changes.push(...committed.changes);
    }
    const progress = await runProgress(run.id, tx).for('update');
    if (run.phase === 'launching')
      await consumeInvasionCards(tx, run, progress);
    if (won) {
      const seed = createHash('sha256')
        .update(`invasion:card:${run.week}:${run.wave}`)
        .digest();
      const drop = invasionCardDrop(
        seed.readUInt32LE(0) / 2 ** 32,
        seed.readUInt32LE(4) / 2 ** 32,
        run.wave,
      );
      for (const entry of progress) {
        if (!invasionFirstClear(entry.completedWave, run.wave)) continue;
        await tx
          .update(invasionProgress)
          .set({
            completedWave: run.wave,
            lastRunId: run.id,
            lastBattleId: runtime.battleId,
            ...(drop
              ? {
                  cards: {
                    ...entry.cards,
                    [drop]: (entry.cards[drop] ?? 0) + 1,
                  },
                }
              : {}),
          })
          .where(progressKey(run.week, entry.userId));
      }
    }
    if (
      !won ||
      Date.now() >= closesAt ||
      !(await invasionRosterMatches(run, tx))
    ) {
      await finishInvasionRun(tx, run.id);
      return changes;
    }
    await tx
      .update(invasionRuns)
      .set({
        phase: 'rest',
        wave: run.wave + 1,
        dueAt: Math.min(closesAt, runtime.playbackEndsAt + INVASION_REST_MS),
        battleId: null,
        ready: [],
        selectedCards: {},
      })
      .where(eq(invasionRuns.id, run.id));
    return changes;
  });
  if (changes) publishResourceEvents(changes);
}
