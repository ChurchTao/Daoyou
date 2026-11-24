import type { BaixiaoRanking } from '@daoyou/contracts/baixiao/meet';
import {
  BAIXIAO_NODE_ID,
  BAIXIAO_RANK_UNIT_MS,
} from '@daoyou/game-domain/baixiao/meet';
import { baixiaoWeek } from '@daoyou/game-rules/baixiao/meet';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import {
  baixiaoEntries as entries,
  baixiaoRounds as rounds,
} from '@server/lib/drizzle/schema.js';
import { createAndPublishWorldChatMessage } from '@server/social/application/chatDelivery.js';
import { and, asc, desc, eq, isNotNull, isNull, lte, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { baixiaoPhase, type Clock, type Round } from './baixiao-view.js';
import { BaixiaoQuestionBank } from './BaixiaoQuestionBank.js';

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
      if (round && now >= clock.opensAt && !round.announcedAt)
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
    const text = '大晋晋京今日开卷，百晓盛会已开场。北京时间 15:45 截止入场。';
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

  private settle(week: string) {
    return this.db.transaction(async (tx) => {
      const [round] = await tx
        .select({ settledAt: rounds.settledAt, closesAt: rounds.closesAt })
        .from(rounds)
        .where(eq(rounds.week, week))
        .for('update');
      const now = new Date();
      if (!round || round.settledAt || round.closesAt > now) return;
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
      await tx
        .update(rounds)
        .set({ settledAt: now })
        .where(eq(rounds.week, week));
    });
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
    return {
      week: clock.week,
      phase: baixiaoPhase(clock, now, current),
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
