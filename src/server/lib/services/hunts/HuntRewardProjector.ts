import { db } from '@server/lib/drizzle/db';
import { cultivators, messageConsumptions } from '@server/lib/drizzle/schema';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { claimMessageForConsumer } from '@server/lib/repositories/messageConsumptionRepository';
import {
  claimJournalOperation,
  completeJournalOperation,
  findJournalOperation,
  journalOperationKey,
} from '@server/lib/repositories/playerJournalRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import { getOrInitCultivationProgress } from '@server/utils/cultivationUtils';
import type { HuntBattleReward } from '@shared/contracts/hunts';
import type { JournalChange } from '@shared/contracts/playerJournal';
import { HUNT_BOSSES } from '@shared/hunts/config';
import { dungeonRewardItemName } from '@shared/rewards/dungeon';
import { HuntRewardSnapshotSchema } from '@shared/rewards/hunt';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type { CultivationProgress } from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ArenaV6Error, ownedArenaV6 } from '../combat-v6/CombatV6ArenaService';
import { CombatV6ArenaStore } from '../combat-v6/CombatV6ArenaStore';
import {
  updateCultivationExp,
  updateSpiritStones,
} from '../cultivator/CultivatorStateRepository';
import { MailService } from '../MailService';
import { publishResourceEvents } from '../playerStateBroadcaster';
import { ResourceEventCommitter } from '../ResourceEventCommitter';
import type { HuntActor } from './HuntTeamService';
import { finishHuntTeam } from './HuntTeamService';
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
        if (
          runtime.terminalReason === 'battle-ended' &&
          runtime.state.result?.winner === 0
        ) {
          for (const p of participants) {
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
  const { runtime } = await ownedArenaV6(battleId, actor);
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
  if (!claim) throw new Error('讨伐领奖凭据不存在');
  const result = HuntJournalResultSchema.parse(claim.event.result);
  if (result.battleId !== battleId) return { status: 'assisting' };
  return {
    status: 'rewarded',
    reward: result.reward,
    mailId: result.mailId,
  };
}
