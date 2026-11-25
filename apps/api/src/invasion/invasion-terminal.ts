import type { ArenaRuntime } from '@daoyou/contracts/combat/arena';
import { createCombatV6Replay } from '@daoyou/game-rules/combat/replay';
import {
  INVASION_REST_MS,
  invasionCardDrop,
  invasionFirstClear,
} from '@daoyou/game-rules/invasion';
import { db } from '@server/lib/drizzle/db.js';
import { invasionProgress, invasionRuns } from '@server/lib/drizzle/schema.js';
import { archiveCombatV6Replay } from '@server/lib/repositories/combatV6ReplayRepository.js';
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

export function invasionBuild(runtime: ArenaRuntime) {
  return {
    units: runtime.units.filter((unit) => unit.side === 0),
    skills: runtime.skills,
    statusDefs: runtime.statusDefs,
    autoStrategies: runtime.autoStrategies,
    unitAppearances: runtime.timeline.unitAppearances,
  };
}

export async function recordInvasionTerminal(runtime: ArenaRuntime) {
  const invasion = runtime.invasion!;
  await db.transaction(async (tx) => {
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
    const closesAt = invasionClosesAt(run.week);
    const endedAt = runtime.terminalAt ?? runtime.deadlineAt;
    const won = runtime.state.result?.winner === 0 && endedAt < closesAt;
    await archiveCombatV6Replay(
      createCombatV6Replay({
        battleId: runtime.battleId,
        participants: runtime.participants,
        metadata: {
          schemaVersion: 1,
          sourceType: 'ancient-demon-invasion',
          battleType: 'pve',
          idempotencyKey: runtime.startRequestId,
          payload: { teamId: run.id, wave: run.wave },
        },
        startedAt: new Date(runtime.createdAt).toISOString(),
        finishedAt: new Date(endedAt).toISOString(),
        reason: runtime.terminalReason!,
        trace: {
          seed: runtime.seed,
          initialUnits: runtime.units,
          skills: runtime.skills,
          statusDefs: runtime.statusDefs,
          rounds: runtime.rounds,
          events: runtime.events,
          finalState: runtime.state,
          timeline: runtime.timeline,
        },
      }),
      tx,
    );
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
        const actor = runtime.participants.find(
          ({ cultivatorId }) => cultivatorId === entry.cultivatorId,
        );
        if (!actor) continue;
        const resources = { ...entry.resources };
        for (const unit of runtime.state.units) {
          if (unit.id !== actor.unitId && unit.ownerId !== actor.unitId)
            continue;
          resources[unit.id] = {
            hp:
              unit.flags.dead || unit.flags.downed || unit.flags.escaped
                ? 0
                : Math.floor(unit.attrs.hp),
            mp: Math.floor(unit.attrs.mp),
            maxHp: unit.attrs.maxHp,
            maxMp: unit.attrs.maxMp,
            benched: unit.flags.benched,
          };
        }
        const firstClear = invasionFirstClear(entry.completedWave, run.wave);
        await tx
          .update(invasionProgress)
          .set({
            resources,
            ...(firstClear
              ? {
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
      return;
    }
    await tx
      .update(invasionRuns)
      .set({
        phase: 'rest',
        wave: run.wave + 1,
        dueAt: Math.min(closesAt, runtime.playbackEndsAt + INVASION_REST_MS),
        battleId: null,
        build: run.build ?? invasionBuild(runtime),
        ready: [],
        selectedCards: {},
      })
      .where(eq(invasionRuns.id, run.id));
  });
}
