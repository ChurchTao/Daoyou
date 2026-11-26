import type { InvasionRanking } from '@daoyou/contracts/invasion';
import {
  INVASION_NODE_ID,
  type InvasionMember,
} from '@daoyou/game-domain/invasion';
import { materialFactsOf } from '@daoyou/game-domain/inventory';
import { ItemLibraryMaterialPayloadSchema } from '@daoyou/game-domain/items/catalog';
import type { invasionWeek } from '@daoyou/game-rules/invasion';
import {
  MAX_WEEKLY_REPUTATION_RANK,
  weeklyReputationForRank,
} from '@daoyou/game-rules/rankings/ranking';
import { rewardAttachments } from '@daoyou/game-rules/rewards/materials';
import { db, type DbExecutor } from '@server/lib/drizzle/db.js';
import {
  cultivators,
  invasionProgress,
  invasionRuns,
  invasionWeeks,
  itemLibrary,
} from '@server/lib/drizzle/schema.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import { MailService } from '@server/mail/application/MailService.js';
import { createAndPublishWorldChatMessage } from '@server/social/application/chatDelivery.js';
import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  sql,
} from 'drizzle-orm';
import { createHash } from 'node:crypto';

export function invasionIdentity(member: InvasionMember) {
  const { cultivatorId, name, title, gender, realm, realmStage } = member;
  return { cultivatorId, name, title, gender, realm, realmStage };
}

export async function prepareInvasionWeek(
  clock: ReturnType<typeof invasionWeek>,
) {
  const [existing] = await db
    .select()
    .from(invasionWeeks)
    .where(eq(invasionWeeks.week, clock.week));
  if (existing) return existing;
  const found = await db
    .select({ payload: itemLibrary.payload })
    .from(itemLibrary)
    .where(
      and(
        eq(itemLibrary.type, 'material'),
        eq(itemLibrary.status, 'published'),
        eq(itemLibrary.category, 'monster'),
      ),
    )
    .orderBy(sql`random()`)
    .limit(100);
  const materials = found.flatMap(({ payload }) => {
    const parsed = ItemLibraryMaterialPayloadSchema.safeParse(payload);
    if (!parsed.success) return [];
    const instanceData = materialFactsOf(parsed.data);
    return instanceData.type === 'monster'
      ? [{ definitionId: 'material.v1', quantity: 1, instanceData }]
      : [];
  });
  if (!materials.length) return;
  await db
    .insert(invasionWeeks)
    .values({ week: clock.week, closesAt: new Date(clock.closesAt), materials })
    .onConflictDoNothing();
  const [week] = await db
    .select()
    .from(invasionWeeks)
    .where(eq(invasionWeeks.week, clock.week));
  return week;
}

export async function announceInvasion(clock: ReturnType<typeof invasionWeek>) {
  const week = await prepareInvasionWeek(clock);
  if (!week) return false;
  if (week.announcedAt) return true;
  const hash = createHash('sha256')
    .update(`invasion:${clock.week}`)
    .digest('hex');
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const text =
    '天南镇魔营地传来警讯，古魔正在冲击界隙。各境道友可结伴驰援，今日 16:00 收阵。';
  await createAndPublishWorldChatMessage({
    id,
    createdAt: new Date(clock.opensAt).toISOString(),
    channel: 'system',
    senderUserId: 'system',
    senderCultivatorId: null,
    senderName: '修仙界传闻',
    senderRealm: '',
    senderRealmStage: '',
    messageType: 'invasion_rumor',
    textContent: text,
    payload: { text, week: clock.week, nodeId: INVASION_NODE_ID },
  });
  await db
    .update(invasionWeeks)
    .set({ announcedAt: new Date() })
    .where(eq(invasionWeeks.week, clock.week));
  return true;
}

export async function publishInvasionWeeks(now: number) {
  const weeks = await db
    .select({ week: invasionWeeks.week })
    .from(invasionWeeks)
    .where(
      and(
        isNull(invasionWeeks.publishedAt),
        lte(invasionWeeks.closesAt, new Date(now)),
      ),
    )
    .limit(10);
  for (const { week } of weeks) {
    const mails = await db.transaction(async (tx) => {
      const [round] = await tx
        .select()
        .from(invasionWeeks)
        .where(eq(invasionWeeks.week, week))
        .for('update');
      if (!round || round.publishedAt) return [];
      const [running] = await tx
        .select({ id: invasionRuns.id })
        .from(invasionRuns)
        .where(
          and(
            eq(invasionRuns.week, week),
            inArray(invasionRuns.phase, ['launching', 'battle', 'rest']),
          ),
        )
        .limit(1);
      if (running) return [];

      const rows = await invasionRankingRows(tx, week);
      const sent = [];
      for (const { rank, realm, recipientId } of rows) {
        if (!recipientId) continue;
        const quantity = weeklyReputationForRank(rank);
        sent.push(
          await MailService.sendNewRewardMail(
            recipientId,
            '古魔入侵排名奖励',
            `本期古魔入侵已封榜。道友在${realm}除魔榜位列第 ${rank} 名，请收下声望 ${quantity}。`,
            rewardAttachments([{ type: 'reputation', quantity }]),
            'reward',
            tx,
          ),
        );
      }
      await tx
        .update(invasionWeeks)
        .set({ publishedAt: new Date() })
        .where(eq(invasionWeeks.week, week));
      return sent;
    });
    for (const mail of mails) {
      publishTransactionalMessageBestEffort(mail.domainEventId, {
        source: 'invasion-ranking-reward',
        mailId: mail.id,
      });
    }
  }
}

function invasionRankingRows(executor: DbExecutor, week: string) {
  const scores = executor.$with('invasion_scores').as(
    executor
      .select({
        runId: invasionRuns.id,
        realm: invasionRuns.realm,
        wave: invasionProgress.completedWave,
      })
      .from(invasionProgress)
      .innerJoin(invasionRuns, eq(invasionRuns.id, invasionProgress.lastRunId))
      .where(eq(invasionProgress.week, week))
      .groupBy(invasionRuns.id, invasionProgress.completedWave),
  );
  const ranked = executor.$with('invasion_ranked').as(
    executor
      .select({
        runId: scores.runId,
        realm: scores.realm,
        wave: scores.wave,
        rank: sql<number>`rank() over (partition by ${scores.realm} order by ${scores.wave} desc)`
          .mapWith(Number)
          .as('rank'),
      })
      .from(scores),
  );
  return executor
    .with(scores, ranked)
    .select({
      runId: ranked.runId,
      realm: ranked.realm,
      wave: ranked.wave,
      rank: ranked.rank,
      memberId: invasionProgress.cultivatorId,
      participants: invasionRuns.members,
      recipientId: cultivators.id,
    })
    .from(ranked)
    .innerJoin(invasionRuns, eq(invasionRuns.id, ranked.runId))
    .innerJoin(
      invasionProgress,
      and(
        eq(invasionProgress.week, week),
        eq(invasionProgress.lastRunId, ranked.runId),
        eq(invasionProgress.completedWave, ranked.wave),
      ),
    )
    .leftJoin(
      cultivators,
      and(
        eq(cultivators.id, invasionProgress.cultivatorId),
        eq(cultivators.userId, invasionProgress.userId),
      ),
    )
    .where(lte(ranked.rank, MAX_WEEKLY_REPUTATION_RANK))
    .orderBy(ranked.rank, ranked.runId, invasionProgress.userId);
}

export async function readInvasionRanking(): Promise<InvasionRanking> {
  const [latest] = await db
    .select({ week: invasionWeeks.week })
    .from(invasionWeeks)
    .where(isNotNull(invasionWeeks.publishedAt))
    .orderBy(desc(invasionWeeks.week))
    .limit(1);
  if (!latest) return { week: null, rows: [] };

  const rows = await invasionRankingRows(db, latest.week);
  const groups = new Map<string, InvasionRanking['rows'][number]>();
  for (const row of rows) {
    const id = `${row.runId}:${row.wave}`;
    const group = groups.get(id) ?? {
      id,
      wave: row.wave,
      realm: row.realm,
      rank: row.rank,
      participants: row.participants.map(invasionIdentity),
      members: [],
    };
    const member = group.participants.find(
      ({ cultivatorId }) => cultivatorId === row.memberId,
    );
    if (member) group.members.push(member);
    groups.set(id, group);
  }
  return { week: latest.week, rows: [...groups.values()] };
}
