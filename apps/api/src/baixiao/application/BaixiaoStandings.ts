import type { BaixiaoRanking } from '@daoyou/contracts/baixiao/meet';
import {
  BAIXIAO_NODE_ID,
  BAIXIAO_RANK_UNIT_MS,
} from '@daoyou/game-domain/baixiao/meet';
import { baixiaoWeek } from '@daoyou/game-rules/baixiao/meet';
import {
  MAX_WEEKLY_REPUTATION_RANK,
  weeklyReputationForRank,
} from '@daoyou/game-rules/rankings/ranking';
import { rewardAttachments } from '@daoyou/game-rules/rewards/materials';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import {
  cultivators,
  baixiaoEntries as entries,
  baixiaoRounds as rounds,
} from '@server/lib/drizzle/schema.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import { MailService } from '@server/mail/application/MailService.js';
import { createAndPublishWorldChatMessage } from '@server/social/application/chatDelivery.js';
import { and, asc, eq, gt, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { type Clock, type Round } from './baixiao-view.js';
import { BaixiaoMeetService } from './BaixiaoMeetService.js';
import { BaixiaoQuestionBank } from './BaixiaoQuestionBank.js';

const rankingOrder = sql`round((${entries.score}->>'totalMs')::numeric / ${BAIXIAO_RANK_UNIT_MS}),
  (${entries.score}->>'correct')::int DESC`;

@Injectable()
export class BaixiaoStandings {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: DbClient,
    @Inject(BaixiaoQuestionBank) private readonly bank: BaixiaoQuestionBank,
    @Inject(BaixiaoMeetService) private readonly meet: BaixiaoMeetService,
  ) {}

  async run() {
    const now = Date.now();
    const ending = await this.db
      .select({ week: rounds.week })
      .from(rounds)
      .where(and(isNull(rounds.settledAt), lte(rounds.closesAt, new Date(now))))
      .orderBy(asc(rounds.closesAt))
      .limit(10);
    for (const { week } of ending) {
      if (!(await this.recoverBeforeSettlement(week, now))) continue;
      await this.settle(week);
    }
    const refreshedAt = Date.now();
    const clock = baixiaoWeek(refreshedAt);
    const round = await this.bank.prepare(clock);
    if (round && !round.announcedAt && (await this.bank.isReady()))
      await this.announce(clock);
    if (clock.closesAt - refreshedAt <= 24 * 3_600_000)
      await this.bank.prepare(baixiaoWeek(refreshedAt, 1));
    return { rounds: ending.length };
  }

  private async announce(clock: Clock) {
    const hash = createHash('sha256')
      .update(`baixiao-week:${clock.week}`)
      .digest('hex');
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const text =
      '大晋晋京开卷，百晓盛会已开场。本期可随时入场，入场后限时作答。';
    await createAndPublishWorldChatMessage({
      id,
      createdAt: new Date().toISOString(),
      channel: 'system',
      senderUserId: 'system',
      senderCultivatorId: null,
      senderName: '修仙界传闻',
      senderRealm: '',
      senderRealmStage: '',
      messageType: 'baixiao_rumor',
      textContent: text,
      payload: { text, week: clock.week, nodeId: BAIXIAO_NODE_ID },
    });
    await this.db
      .update(rounds)
      .set({ announcedAt: new Date() })
      .where(eq(rounds.week, clock.week));
  }

  private async recoverBeforeSettlement(week: string, now: number) {
    const [ongoing] = await this.db
      .select({ userId: entries.userId })
      .from(entries)
      .where(
        and(
          eq(entries.week, week),
          isNull(entries.status),
          gt(entries.endsAt, new Date(now)),
        ),
      )
      .limit(1);
    if (ongoing) return false;

    const pending = await this.db
      .select({
        userId: entries.userId,
        cultivatorId: entries.cultivatorId,
        challengeId: entries.challengeId,
      })
      .from(entries)
      .innerJoin(
        cultivators,
        and(
          eq(cultivators.id, entries.cultivatorId),
          eq(cultivators.userId, entries.userId),
          eq(cultivators.status, 'active'),
        ),
      )
      .where(
        and(
          eq(entries.week, week),
          isNull(entries.status),
          isNotNull(entries.challengeId),
        ),
      );
    for (const { userId, cultivatorId, challengeId } of pending) {
      if (challengeId)
        await this.meet.recoverChallenge(
          { userId, cultivatorId, status: 'active' },
          challengeId,
        );
    }
    return true;
  }

  private async settle(week: string) {
    const mails = await this.db.transaction(async (tx) => {
      const [round] = await tx
        .select({ settledAt: rounds.settledAt, closesAt: rounds.closesAt })
        .from(rounds)
        .where(eq(rounds.week, week))
        .for('update');
      const now = new Date();
      if (!round || round.settledAt || round.closesAt > now) return [];
      const [ongoing] = await tx
        .select({ userId: entries.userId })
        .from(entries)
        .where(
          and(
            eq(entries.week, week),
            isNull(entries.status),
            gt(entries.endsAt, now),
          ),
        )
        .limit(1);
      if (ongoing) return [];
      await tx
        .update(entries)
        .set({ status: 'expired', issuedAt: null, challengeId: null })
        .where(and(eq(entries.week, week), isNull(entries.status)));
      await tx.execute(sql`
        WITH ranked AS (
          SELECT ${entries.userId} AS owner,
            rank() OVER (ORDER BY ${rankingOrder}) AS rank
          FROM ${entries}
          WHERE ${entries.week} = ${week} AND ${entries.status} = 'cleared'
        )
        UPDATE ${entries} SET rank = ranked.rank::int FROM ranked
        WHERE ${entries.week} = ${week} AND ${entries.userId} = ranked.owner
      `);
      const recipients = await tx
        .select({ cultivatorId: entries.cultivatorId, rank: entries.rank })
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
            eq(entries.week, week),
            lte(entries.rank, MAX_WEEKLY_REPUTATION_RANK),
          ),
        )
        .orderBy(asc(entries.cultivatorId));
      const sent = [];
      for (const { cultivatorId, rank } of recipients) {
        if (rank === null) continue;
        const quantity = weeklyReputationForRank(rank);
        const { id, domainEventId } = await MailService.sendNewRewardMail(
          cultivatorId,
          '百晓盛会排名奖励',
          `本期百晓盛会已封榜。道友在才子榜位列第 ${rank} 名，请收下声望 ${quantity}。`,
          rewardAttachments([{ type: 'reputation', quantity }]),
          'reward',
          tx,
        );
        sent.push({ id, domainEventId });
      }
      await tx
        .update(rounds)
        .set({ settledAt: now })
        .where(eq(rounds.week, week));
      return sent;
    });
    for (const mail of mails) {
      publishTransactionalMessageBestEffort(mail.domainEventId, {
        source: 'baixiao-ranking-reward',
        mailId: mail.id,
      });
    }
  }

  async ranking(
    actor: ActiveCultivatorRef,
    previous = false,
  ): Promise<BaixiaoRanking> {
    const now = Date.now();
    const clock = baixiaoWeek(now, previous ? -1 : 0);
    const [round] = await this.db
      .select({ settledAt: rounds.settledAt, closesAt: rounds.closesAt })
      .from(rounds)
      .where(eq(rounds.week, clock.week));
    const closesAt = round?.closesAt.getTime() ?? clock.closesAt;
    const period: BaixiaoRanking['period'] = {
      week: clock.week,
      closesAt,
      state: !round
        ? 'unavailable'
        : round.settledAt
          ? 'settled'
          : now >= closesAt
            ? 'closing'
            : 'live',
    };
    if (!round) return { period, rows: [], mine: null };
    return {
      period,
      ...(await this.readRanks(clock.week, actor, Boolean(round.settledAt))),
    };
  }

  private async readRanks(
    week: Round['week'],
    actor: ActiveCultivatorRef,
    settled: boolean,
  ) {
    const ranked = this.db.$with('baixiao_ranked').as(
      this.db
        .select({
          userId: entries.userId,
          cultivatorId: entries.cultivatorId,
          name: entries.name,
          title: entries.title,
          gender: entries.gender,
          realm: entries.realm,
          score: entries.score,
          rank: (settled
            ? sql<number>`${entries.rank}`
            : sql<number>`rank() over (order by ${rankingOrder})`
          )
            .mapWith(Number)
            .as('rank'),
        })
        .from(entries)
        .where(and(eq(entries.week, week), eq(entries.status, 'cleared'))),
    );
    const result = await this.db
      .with(ranked)
      .select()
      .from(ranked)
      .where(
        or(
          lte(ranked.rank, MAX_WEEKLY_REPUTATION_RANK),
          eq(ranked.userId, actor.userId),
        ),
      )
      .orderBy(asc(ranked.rank), asc(ranked.cultivatorId));
    const rows: BaixiaoRanking['rows'] = [];
    let mine: BaixiaoRanking['mine'] = null;
    for (const { userId, rank, score, ...identity } of result) {
      if (!score || !rank) continue;
      if (userId === actor.userId) mine = { rank, score };
      if (rank <= MAX_WEEKLY_REPUTATION_RANK)
        rows.push({ ...identity, rank, score });
    }
    return { rows, mine };
  }
}
