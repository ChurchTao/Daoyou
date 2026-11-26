import {
  CONTEST_DURATION_MS,
  CONTEST_NODE_ID,
  ContestPaperSchema,
  type ContestStanding,
} from '@daoyou/game-domain/alchemy/contest';
import {
  compareContestStandings,
  contestRewardForRank,
  contestStanding,
  contestWeek,
} from '@daoyou/game-rules/alchemy/contest';
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
import { and, asc, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { createHash, randomInt } from 'node:crypto';

function rewardFor(
  rank: number,
  pool: (typeof rounds.$inferSelect)['rewardPool'],
) {
  const { reputation, odds } = contestRewardForRank(rank);
  const roll = randomInt(10_000) / 10_000;
  const book = pool.books.length
    ? pool.books[randomInt(pool.books.length)]
    : undefined;
  const item =
    roll < odds.book && book
      ? { definitionId: book, quantity: 1 }
      : roll >= odds.book && roll < odds.book + odds.dew
        ? { definitionId: 'beast.refinement.superior-origin-dew', quantity: 1 }
        : roll >= odds.book + odds.dew &&
            roll < odds.book + odds.dew + odds.material &&
            pool.materials.length
          ? pool.materials[randomInt(pool.materials.length)]
          : null;
  return { version: pool.version, reputation, item };
}

@Injectable()
export class AlchemyContestSettlement {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: DbClient) {}

  async run() {
    const now = Date.now();
    const clock = contestWeek(now);
    if (now >= clock.opensAt && now <= clock.lastStartAt)
      await this.announce(clock.week, clock.opensAt);
    const closing = await this.db
      .select({ week: rounds.week })
      .from(rounds)
      .where(and(isNull(rounds.settledAt), lte(rounds.closesAt, new Date(now))))
      .orderBy(asc(rounds.closesAt))
      .limit(10);
    for (const { week } of closing) await this.settle(week);
    const pending = await this.db
      .select({ week: entries.week, userId: entries.userId })
      .from(entries)
      .where(and(isNotNull(entries.reward), isNull(entries.mailedAt)))
      .orderBy(asc(entries.week))
      .limit(100);
    for (const entry of pending) {
      try {
        await this.deliver(entry.week, entry.userId);
      } catch (error) {
        console.error(
          '[alchemy-contest] reward delivery failed',
          entry.week,
          error,
        );
      }
    }
    return { rounds: closing.length, deliveries: pending.length };
  }

  private async announce(week: string, opensAt: number) {
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
      '乱星海丹塔今日开炉，炼丹大会已开赛。北京时间 15:45 截止入场。';
    await createAndPublishWorldChatMessage({
      id,
      createdAt: new Date(opensAt).toISOString(),
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
      const { materials } = ContestPaperSchema.parse(round.paper);
      const players = await tx
        .select()
        .from(entries)
        .where(eq(entries.week, week));
      const scored = players
        .flatMap((entry) => {
          const standing = contestStanding(materials, entry.attempts);
          return standing ? [{ entry, standing }] : [];
        })
        .sort((a, b) => compareContestStandings(a.standing, b.standing));
      let rank = 0;
      let previous: ContestStanding | undefined;
      for (const [index, { entry, standing }] of scored.entries()) {
        if (!previous || compareContestStandings(previous, standing) !== 0)
          rank = index + 1;
        previous = standing;
        await tx
          .update(entries)
          .set({ standing, rank, reward: rewardFor(rank, round.rewardPool) })
          .where(and(eq(entries.week, week), eq(entries.userId, entry.userId)));
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

  private async deliver(week: string, userId: string) {
    const mail = await this.db.transaction(async (tx) => {
      const filters = and(eq(entries.week, week), eq(entries.userId, userId));
      const [entry] = await tx
        .select()
        .from(entries)
        .where(filters)
        .for('update');
      if (!entry?.reward || !entry.rank || entry.mailedAt) return null;
      const [recipient] = await tx
        .select({ id: cultivators.id })
        .from(cultivators)
        .where(
          and(
            eq(cultivators.id, entry.cultivatorId),
            eq(cultivators.userId, userId),
          ),
        );
      const delivery = recipient
        ? await MailService.sendNewRewardMail(
            recipient.id,
            '炼丹大会奖励',
            `道友在 ${week} 的炼丹大会中位列第 ${entry.rank} 名。丹塔将奖励随信送上。`,
            rewardAttachments([
              { type: 'reputation', quantity: entry.reward.reputation },
              ...(entry.reward.item
                ? [
                    {
                      type: 'inventory_v1' as const,
                      inventory: entry.reward.item,
                    },
                  ]
                : []),
            ]),
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
