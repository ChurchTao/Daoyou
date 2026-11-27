import type { BeastRecoveryRequest } from '@daoyou/contracts/beasts';
import { beastRestCost } from '@daoyou/game-rules/beasts/growth';
import { beastVitals } from '@daoyou/game-rules/beasts/projection';
import { BeastError } from '@server/combat/application/BeastMutationGuard.js';
import { hasActiveCombat } from '@server/combat/application/CombatOccupancy.js';
import { updateSpiritStones } from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import { invasionRosterMatches } from '@server/invasion/invasion-run.js';
import { db } from '@server/lib/drizzle/db.js';
import {
  cultivatorBeasts,
  dungeonRuns,
  invasionProgress,
  invasionRuns,
} from '@server/lib/drizzle/schema.js';
import {
  beastIndividualData,
  readBeastRoster,
} from '@server/lib/repositories/combatV6BeastRepository.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { and, eq } from 'drizzle-orm';

export async function recoverOwnedBeasts(
  actor: { userId: string; cultivatorId: string },
  input: BeastRecoveryRequest,
) {
  const { userId, cultivatorId } = actor;
  await playerCommandExecutor.executeWithLock({
    userId,
    cultivatorId,
    source: 'beasts.recover',
    idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) },
    command: async (tx) => {
      const invasion = input.activity?.kind === 'invasion';
      if (
        await hasActiveCombat(cultivatorId, {
          executor: tx,
          includeInvasion: !invasion,
        })
      )
        throw new BeastError('请先结束战斗与结算，再休养灵兽');

      let dueAt: number | undefined;
      if (input.activity?.kind === 'invasion') {
        const [run] = await tx
          .select({ run: invasionRuns })
          .from(invasionRuns)
          .innerJoin(
            invasionProgress,
            eq(invasionProgress.activeRunId, invasionRuns.id),
          )
          .where(
            and(
              eq(invasionRuns.id, input.activity.runId),
              eq(invasionProgress.userId, userId),
              eq(invasionProgress.cultivatorId, cultivatorId),
            ),
          )
          .for('update', { of: invasionRuns });
        if (
          !run ||
          run.run.phase !== 'rest' ||
          !run.run.dueAt ||
          run.run.dueAt <= Date.now() ||
          !(await invasionRosterMatches(run.run, tx))
        )
          throw new BeastError('休憩已结束');
        dueAt = run.run.dueAt;
        await tx
          .update(invasionRuns)
          .set({ ready: run.run.ready.filter((id) => id !== cultivatorId) })
          .where(eq(invasionRuns.id, run.run.id));
      } else if (input.activity?.kind === 'exorcism') {
        const [run] = await tx
          .select()
          .from(dungeonRuns)
          .where(
            and(
              eq(dungeonRuns.id, input.activity.runId),
              eq(dungeonRuns.cultivatorId, cultivatorId),
            ),
          )
          .for('update');
        const state = run?.runState as
          { exorcism?: { phase: string } } | undefined;
        if (
          !run ||
          run.status !== 'EXPLORING' ||
          run.activeBattleId ||
          state?.exorcism?.phase !== 'supply'
        )
          throw new BeastError('补给已结束');
      }

      const roster = await readBeastRoster(cultivatorId, tx);
      const requested = new Map(
        input.beasts.map((beast) => [beast.beastId, beast.expectedRevision]),
      );
      const eligible =
        input.scope === 'bag'
          ? roster.beasts.filter((beast) =>
              roster.lineup.carriedBeastIds.includes(beast.id),
            )
          : roster.beasts.filter((beast) => requested.has(beast.id));
      const items = eligible
        .map((beast) => ({ beast, cost: beastRestCost(beast) }))
        .filter(({ cost }) => cost > 0);
      const cost = items.reduce((total, item) => total + item.cost, 0);
      if (
        items.length !== requested.size ||
        cost !== input.expectedCost ||
        items.some(({ beast }) => requested.get(beast.id) !== beast.revision)
      )
        throw new BeastError('灵兽状态或休养费用已变化，请重新确认');
      if (roster.spiritStones < cost)
        throw new BeastError(`灵石不足，需要 ${cost}`);
      const spiritStones = await updateSpiritStones(
        userId,
        cultivatorId,
        -cost,
        tx,
      );
      for (const { beast } of items) {
        const { maxHp, maxMp } = beastVitals(beast);
        await tx
          .update(cultivatorBeasts)
          .set({
            individual: beastIndividualData({
              ...beast,
              vitals: { hp: maxHp, mp: maxMp },
              revision: beast.revision + 1,
            }),
          })
          .where(
            and(
              eq(cultivatorBeasts.id, beast.id),
              eq(cultivatorBeasts.cultivatorId, cultivatorId),
            ),
          );
      }
      if (dueAt !== undefined && dueAt <= Date.now())
        throw new BeastError('休憩已结束');
      return {
        result: true,
        resourceChanges: [
          {
            resourceTopic: 'player.condition',
            operation: 'invalidate',
            eventType: 'beast.condition.recovered',
          },
          {
            resourceTopic: 'player.currency',
            operation: 'merge',
            eventType: 'currency.spirit_stones.changed',
            payload: { spiritStones },
          },
        ],
      };
    },
  });
  return readBeastRoster(cultivatorId, db);
}
