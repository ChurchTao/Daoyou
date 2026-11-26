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
  baixiaoEntries as entries,
  baixiaoRounds as rounds,
  cultivators,
} from '@server/lib/drizzle/schema.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import { MailService } from '@server/mail/application/MailService.js';
import { createAndPublishWorldChatMessage } from '@server/social/application/chatDelivery.js';
import { and, asc, desc, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { baixiaoPhase, type Clock, type Round } from './baixiao-view.js';
import { BaixiaoQuestionBank } from './BaixiaoQuestionBank.js';

const beijingTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

@Injectable()
export class BaixiaoStandings {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: DbClient,
    @Inject(BaixiaoQuestionBank) private readonly bank: BaixiaoQuestionBank,
  ) {}

  async run() {
    const now = Date.now();
    const clock = baixiaoWeek(now);
    if (now >= clock.opensAt - 5 * 60_000 && now <= clock.lastStartAt) {
      const round = await this.bank.prepare(clock);
      if (
        round &&
        now >= clock.opensAt &&
        !round.announcedAt &&
        (await this.bank.isReady())
      )
        await this.announce(clock);
    }
    const ending = await this.db
      .select({ week: rounds.week })
      .from(rounds)
      .where(and(isNull(rounds.settledAt), lte(rounds.closesAt, new Date(now))))
      .orderBy(asc(rounds.closesAt))
      .limit(10);
    for (const { week } of ending) await this.settle(week);
    return { rounds: ending.length };
  }

  private async announce(clock: Clock) {
    const hash = createHash('sha256')
      .update(`baixiao:${clock.week}`)
      .digest('hex');
    const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    const text = `大晋晋京今日开卷，百晓盛会已开场。北京时间 ${beijingTime.format(clock.lastStartAt)} 截止入场。`;
    await createAndPublishWorldChatMessage({
      id,
      createdAt: new Date(clock.opensAt).toISOString(),
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

  private async settle(week: string) {
    const mails = await this.db.transaction(async (tx) => {
      const [round] = await tx
        .select({ settledAt: rounds.settledAt, closesAt: rounds.closesAt })
        .from(rounds)
        .where(eq(rounds.week, week))
        .for('update');
      const now = new Date();
      if (!round || round.settledAt || round.closesAt > now) return [];
      await tx
        .update(entries)
        .set({ status: 'expired', issuedAt: null, challengeId: null })
        .where(and(eq(entries.week, week), isNull(entries.status)));
      await tx.execute(sql`
        WITH ranked AS (
          SELECT ${entries.userId} AS owner,
            rank() OVER (
              ORDER BY round((${entries.score}->>'totalMs')::numeric / ${BAIXIAO_RANK_UNIT_MS}),
                (${entries.score}->>'correct')::int DESC
            ) AS rank
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

  async ranking(actor: ActiveCultivatorRef): Promise<BaixiaoRanking> {
    const now = Date.now();
    const clock = baixiaoWeek(now);
    const [[current], [published]] = await Promise.all([
      this.db
        .select({ settledAt: rounds.settledAt })
        .from(rounds)
        .where(eq(rounds.week, clock.week)),
      this.db
        .select({ week: rounds.week })
        .from(rounds)
        .where(
          and(
            lte(rounds.week, clock.week),
            lte(rounds.settledAt, new Date(now)),
          ),
        )
        .orderBy(desc(rounds.week))
        .limit(1),
    ]);
    const canStart =
      current && now >= clock.opensAt && now <= clock.lastStartAt;
    const ready = !canStart || (await this.bank.isReady());
    return {
      week: clock.week,
      phase: baixiaoPhase(clock, now, current, ready),
      ...(published
        ? await this.published(published.week, actor)
        : { publishedWeek: null, rows: [], mine: null }),
    };
  }

  private async published(week: Round['week'], actor: ActiveCultivatorRef) {
    const [leaders, [self]] = await Promise.all([
      this.db
        .select({
          cultivatorId: entries.cultivatorId,
          name: entries.name,
          title: entries.title,
          gender: entries.gender,
          realm: entries.realm,
          rank: entries.rank,
          score: entries.score,
        })
        .from(entries)
        .where(and(eq(entries.week, week), isNotNull(entries.rank)))
        .orderBy(asc(entries.rank), asc(entries.cultivatorId))
        .limit(100),
      this.db
        .select({ rank: entries.rank, score: entries.score })
        .from(entries)
        .where(and(eq(entries.week, week), eq(entries.userId, actor.userId))),
    ]);
    return {
      publishedWeek: week,
      rows: leaders.flatMap((row) =>
        row.rank && row.score
          ? [{ ...row, rank: row.rank, score: row.score }]
          : [],
      ),
      mine:
        self?.rank && self.score
          ? { rank: self.rank, score: self.score }
          : null,
    };
  }
}
