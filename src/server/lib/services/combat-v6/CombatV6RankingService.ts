import { db } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher';
import { redis } from '@server/lib/redis';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import {
  finishRanking,
  RANKING_COMPARE,
  RANKING_REPLACE,
  rankingPendingKey,
  rankingRunKey,
  readRankingRun,
  releaseFailedRanking,
  reserveRanking,
  saveRankingReplay,
  type RankingRun,
} from '@server/lib/redis/rankingChallenge';
import {
  getRankingList,
  getRankingListKey,
  getRemainingChallenges,
} from '@server/lib/redis/rankings';
import {
  archiveCombatV6Replay,
  combatV6ReplayExists,
} from '@server/lib/repositories/combatV6ReplayRepository';
import { rankingDay, rankingOrderAfterBattle } from '@shared/combat-v6/ranking';
import { createCombatV6Replay } from '@shared/combat-v6/replay';
import type {
  RankingChallengeRequest,
  RankingChallengeResult,
} from '@shared/contracts/combatV6Ranking';
import {
  compileRankingBattle,
  simulateRankingBattle,
} from '@shared/engine/combat-v6/ranking/battle';
import { and, eq } from 'drizzle-orm';
import { assertInventoryIdle } from '../InventoryService';
import { assembleCombatV6TrainingPlayer } from './CombatV6BuildService';

export class RankingV6Error extends Error {}
type Actor = { userId: string; cultivatorId: string };
async function publishPosition(actor: Actor, result: RankingChallengeResult) {
  if (!result.change || !result.challengerRank) return;
  try {
    const event = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ name: cultivators.name })
        .from(cultivators)
        .where(eq(cultivators.id, actor.cultivatorId));
      return createDomainEvent(
        {
          type: 'ranking.position.changed',
          aggregate: { type: 'cultivator', id: actor.cultivatorId },
          data: {
            ...actor,
            challengerName: row.name,
            realm: result.realm,
            rank: result.challengerRank!,
            changeType: result.change!,
          },
          deduplicationKey: `ranking-v6-position:${actor.cultivatorId}:${result.requestId}`,
        },
        tx,
      );
    });
    publishTransactionalMessageBestEffort(event.id, {
      source: 'ranking-v6',
      cultivatorId: actor.cultivatorId,
    });
  } catch (error) {
    console.error('[ranking-v6] position notification failed', error);
  }
}
export async function pendingRanking(owner: string) {
  const id = await redis.get(rankingPendingKey(owner));
  const run = id ? await readRankingRun(owner, id) : null;
  return run ? run.request : null;
}
export async function runRankingChallenge(
  actor: Actor,
  request: RankingChallengeRequest,
): Promise<RankingChallengeResult> {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(actor.cultivatorId),
      context: 'ranking-v6',
      timeoutMs: 60000,
      retries: 0,
    },
    async (lease) => {
      let run: RankingRun | null = await readRankingRun(
        actor.cultivatorId,
        request.requestId,
      );
      if (run) {
        if (
          run.userId !== actor.userId ||
          run.request.targetId !== request.targetId ||
          run.request.realm !== request.realm
        )
          throw new RankingV6Error('挑战请求参数不一致');
        if (run.result) {
          await publishPosition(actor, run.result);
          return run.result;
        }
        if (run.failed)
          throw new RankingV6Error('本次挑战未能完成，额度已释放，请重新发起');
      } else {
        if (await combatV6ReplayExists(request.requestId))
          throw new RankingV6Error(
            '该挑战已归档，短期恢复状态已失效；请从战绩查看，重新挑战需返回榜单发起',
          );
        await assertInventoryIdle(actor.cultivatorId);
        const now = Date.now();
        const frozen = await db.transaction(
          async (tx) => {
            const [identity] = await tx
              .select()
              .from(cultivators)
              .where(
                and(
                  eq(cultivators.id, actor.cultivatorId),
                  eq(cultivators.userId, actor.userId),
                  eq(cultivators.status, 'active'),
                ),
              );
            if (!identity) throw new RankingV6Error('活跃角色不存在');
            if (!request.targetId) return { identity };
            if (request.targetId === actor.cultivatorId)
              throw new RankingV6Error('不能挑战自己');
            const [target] = await tx
              .select()
              .from(cultivators)
              .where(
                and(
                  eq(cultivators.id, request.targetId),
                  eq(cultivators.status, 'active'),
                ),
              );
            if (!target || target.realm !== request.realm)
              throw new RankingV6Error('被挑战者已不在当前境界榜');
            const a = await assembleCombatV6TrainingPlayer(
              actor.cultivatorId,
              tx,
            );
            const b = await assembleCombatV6TrainingPlayer(
              request.targetId,
              tx,
            );
            return {
              identity,
              target,
              input: compileRankingBattle(
                [a.player, b.player],
                crypto.getRandomValues(new Uint32Array(1))[0],
              ),
            };
          },
          { isolationLevel: 'repeatable read', accessMode: 'read only' },
        );
        const key = getRankingListKey(request.realm);
        const rawOrder = await redis.zrange(key, 0, -1);
        const order = (await getRankingList(request.realm)).map((r) => r.id);
        if (!request.targetId) {
          if (frozen.identity.realm !== request.realm || order.length)
            throw new RankingV6Error('当前不能直接上榜');
          const result: RankingChallengeResult = {
            requestId: request.requestId,
            realm: request.realm,
            day: rankingDay(now),
            type: 'direct_entry',
            affectsRanking: true,
            challengerRank: 1,
            targetRank: null,
            remainingChallenges: await getRemainingChallenges(
              actor.cultivatorId,
            ),
            change: 'direct_entry',
          };
          lease.assertHeld();
          const receipt = { request, userId: actor.userId, result };
          const success = Number(
            await redis.eval(
              `${RANKING_COMPARE}${RANKING_REPLACE}
redis.call('SET',KEYS[2],ARGV[3],'EX',172800)
return 1`,
              2,
              key,
              rankingRunKey(actor.cultivatorId, request.requestId),
              JSON.stringify(rawOrder),
              JSON.stringify([actor.cultivatorId]),
              JSON.stringify(receipt),
            ),
          );
          if (!success) throw new RankingV6Error('榜单已变化，请重新查看');
          await publishPosition(actor, result);
          return result;
        }
        if (!order.includes(request.targetId))
          throw new RankingV6Error('被挑战者已离榜');
        run = {
          request,
          userId: actor.userId,
          owner: actor.cultivatorId,
          day: rankingDay(now),
          startedAt: new Date(now).toISOString(),
          expiresAt: now + 172800000,
          affectsRanking: frozen.identity.realm === request.realm,
          input: frozen.input!,
          participants: [
            { ...actor, unitId: actor.cultivatorId, side: 0, slot: 0 },
            {
              userId: frozen.target!.userId,
              cultivatorId: request.targetId,
              unitId: request.targetId,
              side: 1,
              slot: 0,
            },
          ],
        };
        lease.assertHeld();
        const reserved = await reserveRanking(run);
        if (reserved !== 1)
          throw new RankingV6Error(
            reserved === -2
              ? '今日挑战次数已用完（每日限10次）'
              : '已有挑战，请恢复后再试',
          );
      }
      if (!run.replay) {
        try {
          run.replay = createCombatV6Replay({
            battleId: request.requestId,
            participants: run.participants,
            metadata: {
              schemaVersion: 1,
              sourceType: 'ranking',
              battleType: 'pvp',
              idempotencyKey: request.requestId,
              payload: { realm: request.realm, day: run.day },
            },
            startedAt: run.startedAt,
            finishedAt: new Date().toISOString(),
            reason: 'battle-ended',
            trace: simulateRankingBattle(run.input),
          });
        } catch (e) {
          lease.assertHeld();
          await releaseFailedRanking(run);
          throw e;
        }
        lease.assertHeld();
        await saveRankingReplay(run);
      }
      const replay = run.replay;
      const event = await db.transaction(async (tx) => {
        await archiveCombatV6Replay(replay, tx);
        return createDomainEvent(
          {
            type: 'ranking.challenge.completed',
            aggregate: { type: 'cultivator', id: actor.cultivatorId },
            data: {
              cultivatorId: actor.cultivatorId,
              opponentCultivatorId: request.targetId!,
              battleRecordId: replay.battleId,
            },
            deduplicationKey: `${actor.cultivatorId}:ranking:${replay.battleId}`,
          },
          tx,
        );
      });
      const outcome =
        replay.outcome === 'side-0'
          ? 'victory'
          : replay.outcome === 'draw'
            ? 'draw'
            : 'defeat';
      for (let attempt = 0; attempt < 5; attempt++) {
        const key = getRankingListKey(request.realm);
        const expected = await redis.zrange(key, 0, -1);
        const order = (await getRankingList(request.realm)).map((r) => r.id);
        const [identity] = await db
          .select({ realm: cultivators.realm })
          .from(cultivators)
          .where(eq(cultivators.id, actor.cultivatorId));
        const affectsRanking =
          run.affectsRanking && identity?.realm === request.realm;
        const next = rankingOrderAfterBattle(
          order,
          actor.cultivatorId,
          request.targetId!,
          outcome === 'victory',
          affectsRanking,
        );
        const result: RankingChallengeResult = {
          requestId: request.requestId,
          realm: request.realm,
          day: run.day,
          type: 'battle_result',
          battleId: replay.battleId,
          outcome,
          affectsRanking,
          challengerRank: next.challengerRank,
          targetRank: next.targetRank,
          remainingChallenges: await getRemainingChallenges(
            actor.cultivatorId,
            run.day,
          ),
          change: next.change,
        };
        lease.assertHeld();
        const done = await finishRanking(
          run,
          key,
          expected,
          next.order,
          result,
        );
        if (done === 1) {
          publishTransactionalMessageBestEffort(event.id, {
            source: 'ranking-v6',
            cultivatorId: actor.cultivatorId,
          });
          await publishPosition(actor, result);
          return result;
        }
        if (done < 0)
          throw new RankingV6Error('挑战恢复状态已丢失，请刷新榜单');
      }
      throw new RankingV6Error('榜单正在变化，请重试完成结算');
    },
  );
}
