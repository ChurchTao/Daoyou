import { db } from '@server/lib/drizzle/db.js';
import { cultivators, messageConsumptions } from '@server/lib/drizzle/schema.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import { claimMessageForConsumer } from '@server/lib/repositories/messageConsumptionRepository.js';
import {
  claimJournalOperation,
  completeJournalOperation,
  findJournalOperation,
  journalOperationKey,
} from '@server/lib/repositories/playerJournalRepository.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import { getOrInitCultivationProgress } from '@daoyou/game-rules/cultivation';
import type { HuntBattleReward } from '@daoyou/contracts/hunts';
import type { JournalChange } from '@daoyou/game-domain/journal/changes';
import { HUNT_BOSSES } from '@daoyou/game-content/hunts';
import {
  huntParticipantSucceeded,
  settleHuntResources,
} from '@daoyou/game-rules/hunts';
import { dungeonRewardItemName } from '@daoyou/game-rules/rewards/dungeon';
import { HuntRewardSnapshotSchema } from '@daoyou/game-rules/rewards/hunt';
import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import type { CultivationProgress } from '@daoyou/game-domain/character';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ArenaV6Error, ownedArenaV6 } from '@server/combat/application/CombatV6ArenaService.js';
import { CombatV6ArenaStore } from '@server/combat/application/CombatV6ArenaStore.js';
import { ConditionService } from '@server/cultivator/application/ConditionService.js';
import {
  updateCultivationExp,
  updateSpiritStones,
} from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import { MailService } from '@server/mail/application/MailService.js';
import { publishResourceEvents } from '@server/realtime/infrastructure/playerStateBroadcaster.js';
import { ResourceEventCommitter } from '@server/player/application/state/ResourceEventCommitter.js';
import type { HuntActor } from '@server/hunts/application/HuntTeamService.js';
import { finishHuntTeam } from '@server/hunts/application/HuntTeamService.js';
const store = new CombatV6ArenaStore();
export const HUNT_REWARD_CONSUMER = 'hunt-reward-v1';
const HuntJournalResultSchema = z.object({
  battleId: z.uuid(),
  reward: HuntRewardSnapshotSchema,
  mailId: z.uuid().optional(),
});
export async function projectHuntReward(battleId: string) {
  const runtime = await store.get(battleId);
  if (!runtime) {
    const receipt = await db
      .select({ id: messageConsumptions.messageId })
      .from(messageConsumptions)
      .where(
        and(
          eq(messageConsumptions.messageId, battleId),
          eq(messageConsumptions.consumerName, HUNT_REWARD_CONSUMER),
        ),
      )
      .limit(1);
    if (receipt.length) return;
    throw new Error('HUNT_TERMINAL_MISSING');
  }
  if (!runtime.hunt || runtime.stage !== 'finished')
    throw new Error('HUNT_NOT_FINISHED');
  const event = runtime.hunt;
  const participants = [...runtime.participants].sort((a, b) =>
    a.cultivatorId.localeCompare(b.cultivatorId),
  );
  await withRedisLock(
    {
      keys: participants.map((p) =>
        redisLockKeys.cultivatorMutation(p.cultivatorId),
      ),
      context: 'hunt-rewards',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) => {
      const commits = await db.transaction(async (tx) => {
        for (const p of participants)
          await lockCultivatorForStateMutation(tx, p.cultivatorId);
        if (
          !(await claimMessageForConsumer(
            {
              consumerName: HUNT_REWARD_CONSUMER,
              messageId: battleId,
              messageKey: 'combat.v6.battle.finished',
            },
            tx,
          ))
        )
          return { changes: [], mailEvents: [] };
        const changes = [];
        const mailEvents: string[] = [];
        // Resources and rewards share the transport receipt and transaction, including defeat/assist.
        if (runtime.huntResourcePolicy === 'persistent') {
          for (const p of participants) {
            const row = await tx.query.cultivators.findFirst({
              where: and(
                eq(cultivators.id, p.cultivatorId),
                eq(cultivators.userId, p.userId),
              ),
            });
            if (!row?.condition) throw new Error('讨伐角色状态不存在');
            const resources = settleHuntResources(
              runtime.units.find((u) => u.id === p.unitId)?.attrs,
              runtime.state.units.find((u) => u.id === p.unitId),
              runtime.terminalReason === 'technical-abort',
            );
            await tx
              .update(cultivators)
              .set({
                condition: ConditionService.applyCombatV6Resources(
                  row.condition as CultivatorCondition,
                  resources,
                ),
              })
              .where(eq(cultivators.id, p.cultivatorId));
            const committed = await new ResourceEventCommitter().commit(tx, {
              actor: p,
              source: 'hunt-condition',
              scopeDefaults: { cultivatorId: p.cultivatorId },
              changes: [
                {
                  resourceTopic: 'player.condition',
                  operation: 'invalidate',
                  eventType: 'combat_v6.condition.settled',
                },
              ],
            });
            changes.push(...committed.changes);
          }
        }
        if (
          runtime.terminalReason === 'battle-ended' &&
          runtime.state.result?.winner === 0
        ) {
          for (const p of participants) {
            if (!huntParticipantSucceeded(runtime.state, p.unitId)) continue;
            // Legacy active battles retain their original stone-only reward.
            const frozen =
              runtime.huntRewards?.[p.cultivatorId] ??
              (event.spiritStones !== undefined
                ? {
                    poolId: 'hunt.legacy',
                    poolVersion: 1,
                    spiritStones: event.spiritStones,
                    experience: 0,
                    insight: 0,
                    items: [],
                  }
                : undefined);
            const reward = HuntRewardSnapshotSchema.parse(frozen);
            const claim = await claimJournalOperation(tx, {
              cultivatorId: p.cultivatorId,
              operationKey: journalOperationKey('hunt_reward', event.id),
              fingerprint: null,
            });
            if (claim.previous) continue; // Assistants receive neither resources nor item mail.
            const before = await tx.query.cultivators.findFirst({
              where: and(
                eq(cultivators.id, p.cultivatorId),
                eq(cultivators.userId, p.userId),
              ),
            });
            if (!before) throw new Error('讨伐角色不存在');
            const progress = getOrInitCultivationProgress(
              (before.cultivation_progress ?? {}) as CultivationProgress,
              before.realm as RealmType,
              before.realm_stage as RealmStage,
            );
            const stones = await updateSpiritStones(
              p.userId,
              p.cultivatorId,
              reward.spiritStones,
              tx,
            );
            const after = await updateCultivationExp(
              p.userId,
              p.cultivatorId,
              reward.experience,
              reward.insight,
              tx,
            );
            const actual = {
              ...reward,
              spiritStones: stones - before.spirit_stones,
              experience: after.cultivation_exp - progress.cultivation_exp,
              insight:
                after.comprehension_insight - progress.comprehension_insight,
            };
            const mail = reward.items.length
              ? await MailService.sendNewRewardMail(
                  p.cultivatorId,
                  '结伴讨伐·战利品',
                  `道友已平定${event.locationName}的异动，此次讨伐所得道具随信送达。`,
                  reward.items.map((item) => ({
                    type: 'inventory_v1' as const,
                    name: dungeonRewardItemName(item),
                    quantity: item.quantity,
                    inventory: item,
                  })),
                  'reward',
                  tx,
                )
              : undefined;
            if (mail) mailEvents.push(mail.domainEventId);
            // Item mail is pending delivery; only its later claim records item income.
            const journalChanges: JournalChange[] = [
              {
                kind: 'resource',
                resource: 'spiritStones',
                amount: actual.spiritStones,
              },
              { kind: 'resource', resource: 'exp', amount: actual.experience },
              { kind: 'resource', resource: 'insight', amount: actual.insight },
            ];
            await completeJournalOperation(tx, claim.id, {
              type: 'resources.settled',
              activity: 'hunt_reward',
              detail: `${event.locationName}·${HUNT_BOSSES[event.bossId].name}`,
              changes: journalChanges.filter((change) => change.amount !== 0),
              result: HuntJournalResultSchema.parse({
                battleId,
                reward: actual,
                mailId: mail?.id,
              }),
            });
            const committed = await new ResourceEventCommitter().commit(tx, {
              actor: p,
              source: 'hunt-reward',
              scopeDefaults: { cultivatorId: p.cultivatorId },
              changes: [
                {
                  resourceTopic: 'player.currency',
                  operation: 'invalidate',
                  eventType: 'hunt.rewarded',
                },
                {
                  resourceTopic: 'player.progress',
                  operation: 'invalidate',
                  eventType: 'hunt.rewarded',
                },
              ],
            });
            changes.push(...committed.changes);
          }
        }
        lease.assertHeld();
        return { changes, mailEvents };
      });
      if (commits.changes.length) publishResourceEvents(commits.changes);
      for (const id of commits.mailEvents)
        publishTransactionalMessageBestEffort(id, { source: 'hunt-reward' });
    },
  );
  // A committed claim remains authoritative if any Redis cleanup step must retry.
  await finishHuntTeam(runtime.roomId, battleId, runtime.startRequestId);
  await store.release(runtime);
  await store.acknowledge(runtime);
}

export async function huntBattleReward(
  battleId: string,
  actor: HuntActor,
): Promise<HuntBattleReward> {
  const { runtime, participant } = await ownedArenaV6(battleId, actor);
  if (!runtime.hunt) throw new ArenaV6Error('不是讨伐战斗', 400);
  const [receipt] = await db
    .select({ id: messageConsumptions.messageId })
    .from(messageConsumptions)
    .where(
      and(
        eq(messageConsumptions.messageId, battleId),
        eq(messageConsumptions.consumerName, HUNT_REWARD_CONSUMER),
      ),
    )
    .limit(1);
  if (!receipt) return { status: 'pending' };
  if (
    runtime.terminalReason !== 'battle-ended' ||
    runtime.state.result?.winner !== 0
  )
    return { status: 'no-reward' };
  const claim = await findJournalOperation(
    actor.cultivatorId,
    journalOperationKey('hunt_reward', runtime.hunt.id),
    null,
  );
  const result = claim
    ? HuntJournalResultSchema.parse(claim.event.result)
    : undefined;
  // Already committed historical rewards stay authoritative across rule changes.
  if (result?.battleId === battleId)
    return { status: 'rewarded', reward: result.reward, mailId: result.mailId };
  if (!huntParticipantSucceeded(runtime.state, participant.unitId)) {
    const unit = runtime.state.units.find((u) => u.id === participant.unitId);
    return {
      status: 'no-reward',
      reason:
        unit && (unit.attrs.hp <= 0 || unit.flags.dead || unit.flags.downed)
          ? 'fallen'
          : undefined,
    };
  }
  if (!result) throw new Error('讨伐领奖凭据不存在');
  return { status: 'assisting' };
}
