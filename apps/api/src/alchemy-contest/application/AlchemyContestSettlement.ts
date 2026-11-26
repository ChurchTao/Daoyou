import {
  CONTEST_DURATION_MS,
  CONTEST_NODE_ID,
} from '@daoyou/game-domain/alchemy/contest';
import { contestWeek } from '@daoyou/game-rules/alchemy/contest';
import {
  MAX_WEEKLY_REPUTATION_RANK,
  weeklyReputationForRank,
} from '@daoyou/game-rules/rankings/ranking';
import { rewardAttachments } from '@daoyou/game-rules/rewards/materials';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import {
  cultivators,
  alchemyContestEntries as entries,
  alchemyContestRounds as rounds,
} from '@server/lib/drizzle/schema.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import { MailService } from '@server/mail/application/MailService.js';
import { createAndPublishWorldChatMessage } from '@server/social/application/chatDelivery.js';
import {
  and,
  asc,
  eq,
  gt,
  isNotNull,
  isNull,
  lte,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { grantContestCompletion } from './AlchemyContestRewards.js';
import { contestRankedEntries } from './contest-ranking.js';

@Injectable()
export class AlchemyContestSettlement {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: DbClient) {}

  async run() {
    const now = Date.now();
    const closing = await this.db
      .select({ week: rounds.week })
      .from(rounds)
      .where(and(isNull(rounds.settledAt), lte(rounds.closesAt, new Date(now))))
      .orderBy(asc(rounds.closesAt))
      .limit(10);
    for (const { week } of closing) await this.settle(week);
    const completed = await this.db
      .select({
        week: entries.week,
        userId: entries.userId,
        cultivatorId: entries.cultivatorId,
      })
      .from(entries)
      .innerJoin(
        cultivators,
        and(
          eq(cultivators.id, entries.cultivatorId),
          eq(cultivators.userId, entries.userId),
        ),
      )
      .where(
        and(
          isNull(entries.completionReward),
          notInArray(cultivators.status, ['transfer_pending', 'transferred']),
          or(
            isNotNull(entries.finishedAt),
            lte(entries.startedAt, new Date(now - CONTEST_DURATION_MS)),
          ),
          sql`${entries.attempts} @> '[{"qualified":true}]'::jsonb`,
        ),
      )
      .orderBy(asc(entries.startedAt), asc(entries.userId))
      .limit(100);
    for (const entry of completed) {
      try {
        await grantContestCompletion(entry.week, entry);
      } catch (error) {
        console.error(
          '[alchemy-contest] completion reward failed',
          entry.week,
          error,
        );
      }
    }
    const pending = await this.db
      .select({
        week: entries.week,
        userId: entries.userId,
        cultivatorId: entries.cultivatorId,
      })
      .from(entries)
      .where(
        and(
          isNotNull(entries.reward),
          isNull(entries.mailedAt),
          lte(entries.rank, MAX_WEEKLY_REPUTATION_RANK),
        ),
      )
      .orderBy(asc(entries.week))
      .limit(100);
    for (const entry of pending) {
      try {
        await this.deliver(entry.week, entry.userId, entry.cultivatorId);
      } catch (error) {
        console.error(
          '[alchemy-contest] reward delivery failed',
          entry.week,
          error,
        );
      }
    }
    const clock = contestWeek(Date.now());
    await this.announce(clock.week);
    return {
      rounds: closing.length,
      completions: completed.length,
      deliveries: pending.length,
    };
  }

  private async announce(week: string) {
    const [round] = await this.db
      .select({ announcedAt: rounds.announcedAt })
      .from(rounds)
      .where(eq(rounds.week, week));
    if (!round || round.announcedAt) return;
    const digest = createHash('sha256')
      .update(`alchemy-contest:${week}`)
      .digest('hex');
    const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    const text =
      '乱星海丹塔开炉，炼丹大会已开赛。本期可随时入场，入场后限时炼制。';
    await createAndPublishWorldChatMessage({
      id,
      createdAt: new Date().toISOString(),
      channel: 'system',
      senderUserId: 'system',
      senderCultivatorId: null,
      senderName: '修仙界传闻',
      senderRealm: '',
      senderRealmStage: '',
      messageType: 'alchemy_contest_rumor',
      textContent: text,
      payload: { text, week, nodeId: CONTEST_NODE_ID },
    });
    await this.db
      .update(rounds)
      .set({ announcedAt: new Date() })
      .where(eq(rounds.week, week));
  }

  private settle(week: string) {
    return this.db.transaction(async (tx) => {
      const [round] = await tx
        .select()
        .from(rounds)
        .where(eq(rounds.week, week))
        .for('update');
      const now = new Date();
      if (!round || round.settledAt || now < round.closesAt) return;
      const [ongoing] = await tx
        .select({ userId: entries.userId })
        .from(entries)
        .where(
          and(
            eq(entries.week, week),
            isNull(entries.finishedAt),
            gt(
              entries.startedAt,
              new Date(now.getTime() - CONTEST_DURATION_MS),
            ),
          ),
        )
        .limit(1);
      if (ongoing) return;

      const ranked = contestRankedEntries(tx, week);
      const scores = await tx
        .with(ranked)
        .select({ userId: ranked.userId, rank: ranked.rank })
        .from(ranked);
      for (const { userId, rank } of scores) {
        await tx
          .update(entries)
          .set({ rank, reward: { reputation: weeklyReputationForRank(rank) } })
          .where(and(eq(entries.week, week), eq(entries.userId, userId)));
      }
      await tx
        .update(entries)
        .set({
          finishedAt: sql`${entries.startedAt} + ${CONTEST_DURATION_MS} * interval '1 millisecond'`,
        })
        .where(and(eq(entries.week, week), isNull(entries.finishedAt)));
      await tx
        .update(rounds)
        .set({ settledAt: now })
        .where(eq(rounds.week, week));
    });
  }

  private async deliver(week: string, userId: string, cultivatorId: string) {
    const mail = await this.db.transaction(async (tx) => {
      // Lock the recipient before the entry, matching personal settlement.
      const [recipient] = await tx
        .select({ id: cultivators.id })
        .from(cultivators)
        .where(
          and(eq(cultivators.id, cultivatorId), eq(cultivators.userId, userId)),
        )
        .for('key share');
      const filters = and(eq(entries.week, week), eq(entries.userId, userId));
      const [entry] = await tx
        .select()
        .from(entries)
        .where(filters)
        .for('update');
      if (!entry?.reward || !entry.rank || entry.mailedAt) return null;
      const { reputation } = entry.reward;
      const delivery =
        recipient && entry.cultivatorId === cultivatorId && reputation > 0
          ? await MailService.sendNewRewardMail(
              recipient.id,
              '炼丹大会排名奖励',
              `道友在 ${week} 的炼丹大会中位列第 ${entry.rank} 名，请收下声望 ${reputation}。`,
              rewardAttachments([{ type: 'reputation', quantity: reputation }]),
              'reward',
              tx,
            )
          : null;
      await tx
        .update(entries)
        .set({
          mailedAt: new Date(),
        })
        .where(filters);
      return delivery;
    });
    if (mail)
      publishTransactionalMessageBestEffort(mail.domainEventId, {
        source: 'alchemy-contest-reward',
        mailId: mail.id,
      });
  }
}
