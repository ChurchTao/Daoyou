import type {
  ContestBrewCommand,
  ContestRanking,
  ContestRankingDetail,
  ContestStatus,
} from '@daoyou/contracts/alchemy/contest';
import {
  CONTEST_ATTEMPTS,
  CONTEST_DURATION_MS,
  CONTEST_QI,
  ContestPaperSchema,
  type ContestAttempt,
} from '@daoyou/game-domain/alchemy/contest';
import {
  brewContestFurnace,
  contestBudget,
  contestStanding,
  contestWeek,
  scoreContestFurnace,
  validContestRecipe,
} from '@daoyou/game-rules/alchemy/contest';
import { MAX_WEEKLY_REPUTATION_RANK } from '@daoyou/game-rules/rankings/ranking';
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type {
  DbClient,
  DbExecutor,
  DbTransaction,
} from '@server/lib/drizzle/db.js';
import {
  cultivators,
  alchemyContestEntries as entries,
  alchemyContestRounds as rounds,
} from '@server/lib/drizzle/schema.js';
import { and, asc, eq, gt, inArray, isNull, lte, or } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { grantContestCompletion } from './AlchemyContestRewards.js';
import { contestRankedEntries } from './contest-ranking.js';

type Round = typeof rounds.$inferSelect;
type Entry = typeof entries.$inferSelect;

function weekTimes(week: string) {
  return contestWeek(Date.parse(`${week}T00:00:00+08:00`));
}

function phaseAt(
  clock: ReturnType<typeof contestWeek>,
  now: number,
  round?: Pick<Round, 'settledAt' | 'closesAt'>,
): ContestStatus['phase'] {
  if (now < clock.opensAt) return 'waiting';
  if (round?.settledAt) return 'settled';
  if (now >= (round?.closesAt.getTime() ?? clock.closesAt)) return 'closed';
  if (!round) return 'unavailable';
  return 'open';
}

function view(
  clock: ReturnType<typeof contestWeek>,
  now: number,
  round?: Round,
  entry?: Entry,
  actor?: ActiveCultivatorRef,
): ContestStatus {
  const otherCharacter = Boolean(
    entry && entry.cultivatorId !== actor?.cultivatorId,
  );
  const player = otherCharacter ? undefined : entry;
  const deadline = player
    ? player.startedAt.getTime() + CONTEST_DURATION_MS
    : 0;
  const paper = round && player ? ContestPaperSchema.parse(round.paper) : null;
  const attempts =
    player?.attempts.map((attempt): ContestAttempt => ({
      doses: attempt.doses,
      heat: attempt.heat,
      acceptedAt: attempt.acceptedAt,
      effects: attempt.effects,
      lots: attempt.lots,
      qualifiedLots: attempt.qualifiedLots,
      stability: attempt.stability,
      purity: attempt.purity,
      toxicity: attempt.toxicity,
      appearance: attempt.appearance,
      qualified: attempt.qualified,
      reason: attempt.reason,
      points: attempt.points,
      score: attempt.score,
    })) ?? [];
  const budget =
    paper && player ? contestBudget(paper.materials, attempts) : null;
  return {
    week: clock.week,
    opensAt: new Date(clock.opensAt).toISOString(),
    closesAt: new Date(clock.closesAt).toISOString(),
    serverTime: new Date(now).toISOString(),
    phase: phaseAt(clock, now, round),
    session:
      paper && player && budget
        ? {
            deadline: new Date(deadline).toISOString(),
            finished: Boolean(player.finishedAt) || now >= deadline,
            question: paper.question,
            materials: paper.materials
              .toSorted((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
              .map(({ id, name, description, type, rank, element }) => ({
                id,
                name,
                description,
                type,
                rank,
                element,
              })),
            remaining: budget.remaining,
            qi: budget.qi,
            attempts,
            standing: player.standing,
            completionReward: player.completionReward,
          }
        : null,
    otherCharacter,
  };
}

@Injectable()
export class AlchemyContestService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: DbClient) {}

  private async previousSession(
    actor: ActiveCultivatorRef,
    now: number,
    executor: DbExecutor = this.db,
  ) {
    if (now >= contestWeek(now).opensAt + CONTEST_DURATION_MS) return undefined;
    const clock = contestWeek(now, -1);
    const [entry] = await executor
      .select()
      .from(entries)
      .where(
        and(
          eq(entries.week, clock.week),
          eq(entries.userId, actor.userId),
          eq(entries.cultivatorId, actor.cultivatorId),
          isNull(entries.finishedAt),
          gt(entries.startedAt, new Date(now - CONTEST_DURATION_MS)),
        ),
      );
    return entry ? { clock, entry } : undefined;
  }

  async status(actor: ActiveCultivatorRef): Promise<ContestStatus> {
    const now = Date.now();
    const clock = contestWeek(now);
    const ongoing = await this.previousSession(actor, now);
    if (ongoing) {
      const [round] = await this.db
        .select()
        .from(rounds)
        .where(eq(rounds.week, ongoing.clock.week));
      if (round && !round.settledAt)
        return view(ongoing.clock, now, round, ongoing.entry, actor);
    }
    const [[round], [entry]] = await Promise.all([
      this.db.select().from(rounds).where(eq(rounds.week, clock.week)),
      this.db
        .select()
        .from(entries)
        .where(
          and(eq(entries.week, clock.week), eq(entries.userId, actor.userId)),
        ),
    ]);
    return view(clock, now, round, entry, actor);
  }

  private async lockEntry(
    tx: DbTransaction,
    week: string,
    actor: ActiveCultivatorRef,
  ) {
    const [round] = await tx
      .select()
      .from(rounds)
      .where(eq(rounds.week, week))
      .for('share');
    const clock = weekTimes(week);
    if (!round || clock.week !== week || Date.now() < clock.opensAt)
      throw new ConflictException('该期炼丹大会尚未开放。');
    const [entry] = await tx
      .select()
      .from(entries)
      .where(and(eq(entries.week, week), eq(entries.userId, actor.userId)))
      .for('update');
    if (entry && entry.cultivatorId !== actor.cultivatorId)
      throw new ForbiddenException('本账号已用另一位角色参赛。');
    return { round, entry };
  }

  start(week: string, actor: ActiveCultivatorRef) {
    return this.db.transaction(async (tx) => {
      const { round, entry } = await this.lockEntry(tx, week, actor);
      const now = Date.now();
      const clock = weekTimes(week);
      if (entry) return view(clock, now, round, entry, actor);
      if (
        week !== contestWeek(now).week ||
        round.settledAt ||
        now >= round.closesAt.getTime()
      )
        throw new ConflictException('当前无法入场，请查看本期赛程。');
      if (await this.previousSession(actor, now, tx))
        throw new ConflictException('请先完成上周已开局的炼制。');
      const [cultivator] = await tx
        .select({ name: cultivators.name })
        .from(cultivators)
        .where(
          and(
            eq(cultivators.id, actor.cultivatorId),
            eq(cultivators.userId, actor.userId),
          ),
        );
      if (!cultivator) throw new ForbiddenException('当前角色无法参赛。');
      const [created] = await tx
        .insert(entries)
        .values({
          week,
          userId: actor.userId,
          cultivatorId: actor.cultivatorId,
          name: cultivator.name,
          startedAt: new Date(now),
        })
        .onConflictDoNothing()
        .returning();
      if (created) return view(clock, now, round, created, actor);
      const locked = await this.lockEntry(tx, week, actor);
      return view(clock, now, round, locked.entry, actor);
    });
  }

  async brew(command: ContestBrewCommand, actor: ActiveCultivatorRef) {
    const status = await this.db.transaction(async (tx) => {
      const { round, entry } = await this.lockEntry(tx, command.week, actor);
      if (!entry) throw new ConflictException('请先入场参赛。');
      const now = Date.now();
      const clock = weekTimes(command.week);
      const doses = command.doses.toSorted((a, b) =>
        a.materialId.localeCompare(b.materialId),
      );
      const previous = entry.attempts.find(
        (attempt) => attempt.requestId === command.requestId,
      );
      if (previous) {
        if (
          previous.heat !== command.heat ||
          entry.attempts.indexOf(previous) !== command.expectedAttempts ||
          previous.doses.length !== doses.length ||
          previous.doses.some(
            (item, index) =>
              item.materialId !== doses[index].materialId ||
              item.dose !== doses[index].dose,
          )
        )
          throw new ConflictException(
            '这次开炉请求已用于另一副配方，请刷新赛况。',
          );
        return view(clock, now, round, entry, actor);
      }
      const elapsed = now - entry.startedAt.getTime();
      if (round.settledAt || entry.finishedAt || elapsed >= CONTEST_DURATION_MS)
        throw new ConflictException('本场参赛已结束。');
      if (
        entry.attempts.length !== command.expectedAttempts ||
        entry.attempts.length >= CONTEST_ATTEMPTS
      )
        throw new ConflictException('炉次已更新，请刷新赛况。');
      const paper = ContestPaperSchema.parse(round.paper);
      if (
        !validContestRecipe(
          { heat: command.heat, doses },
          contestBudget(paper.materials, entry.attempts),
        )
      )
        throw new UnprocessableEntityException(
          '材料或炉气不足，或投料超出单炉限制。',
        );
      const used = doses.map(({ materialId, dose }) => ({
        ...paper.materials.find((material) => material.id === materialId)!,
        dose,
      }));
      const result = scoreContestFurnace(
        brewContestFurnace(used, command.heat),
        paper.question,
        command.heat,
        elapsed,
        randomInt(-100, 101) / 100,
      );
      const attempts = [
        ...entry.attempts,
        {
          ...result,
          requestId: command.requestId,
          doses,
          heat: command.heat,
          acceptedAt: new Date(now).toISOString(),
        },
      ];
      const finishedAt =
        attempts.length === CONTEST_ATTEMPTS ? new Date(now) : null;
      const [updated] = await tx
        .update(entries)
        .set({
          attempts,
          standing: contestStanding(paper.materials, attempts),
          finishedAt,
        })
        .where(
          and(eq(entries.week, command.week), eq(entries.userId, actor.userId)),
        )
        .returning();
      return view(clock, now, round, updated, actor);
    });
    return this.withCompletionReward(status, actor);
  }

  async finish(week: string, actor: ActiveCultivatorRef) {
    const status = await this.db.transaction(async (tx) => {
      const { round, entry } = await this.lockEntry(tx, week, actor);
      if (!entry) throw new ConflictException('请先入场参赛。');
      const now = Date.now();
      if (round.settledAt)
        return view(weekTimes(week), now, round, entry, actor);
      const finishedAt =
        entry.finishedAt ??
        new Date(
          Math.min(now, entry.startedAt.getTime() + CONTEST_DURATION_MS),
        );
      await tx
        .update(entries)
        .set({ finishedAt })
        .where(and(eq(entries.week, week), eq(entries.userId, actor.userId)));
      return view(weekTimes(week), now, round, { ...entry, finishedAt }, actor);
    });
    return this.withCompletionReward(status, actor);
  }

  private async withCompletionReward(
    status: ContestStatus,
    actor: ActiveCultivatorRef,
  ) {
    const { session } = status;
    if (!session?.finished || !session.standing || session.completionReward)
      return status;
    try {
      const completionReward = await grantContestCompletion(status.week, actor);
      return { ...status, session: { ...session, completionReward } };
    } catch (error) {
      console.error(
        '[alchemy-contest] completion reward failed',
        status.week,
        error,
      );
      return status;
    }
  }

  async ranking(
    actor: ActiveCultivatorRef,
    previous = false,
  ): Promise<ContestRanking> {
    const now = Date.now();
    const clock = contestWeek(now, previous ? -1 : 0);
    const [round] = await this.db
      .select()
      .from(rounds)
      .where(eq(rounds.week, clock.week));
    const closesAt = round?.closesAt.getTime() ?? clock.closesAt;
    const period: ContestRanking['period'] = {
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
    if (!round)
      return { period, title: null, pillName: null, entries: [], own: null };

    const ranked = contestRankedEntries(
      this.db,
      round.week,
      Boolean(round.settledAt),
    );
    const rows = await this.db
      .with(ranked)
      .select({
        userId: ranked.userId,
        id: ranked.cultivatorId,
        name: ranked.name,
        title: cultivators.title,
        realm: cultivators.realm,
        realmStage: cultivators.realm_stage,
        gender: cultivators.gender,
        standing: ranked.standing,
        rank: ranked.rank,
        reward: ranked.reward,
      })
      .from(ranked)
      .leftJoin(cultivators, eq(cultivators.id, ranked.cultivatorId))
      .where(
        or(
          lte(ranked.rank, MAX_WEEKLY_REPUTATION_RANK),
          eq(ranked.userId, actor.userId),
        ),
      )
      .orderBy(asc(ranked.rank), asc(ranked.cultivatorId));
    const leaders: ContestRanking['entries'] = [];
    let own: ContestRanking['own'] = null;
    for (const { userId, rank, standing, reward, ...identity } of rows) {
      if (!rank || !standing) continue;
      if (userId === actor.userId)
        own = { id: identity.id, rank, score: standing.score };
      if (rank <= MAX_WEEKLY_REPUTATION_RANK)
        leaders.push({
          ...identity,
          rank,
          score: standing.score,
          reputation: reward?.reputation ?? null,
        });
    }
    return {
      period,
      title: round.paper.question.title,
      pillName: round.paper.question.pillName,
      entries: leaders,
      own,
    };
  }

  async rankingDetail(
    cultivatorId: string,
    requestedWeek?: string,
  ): Promise<ContestRankingDetail> {
    const now = Date.now();
    const current = contestWeek(now).week;
    const previous = contestWeek(now, -1).week;
    const week = requestedWeek ?? current;
    if (week !== current && week !== previous)
      throw new NotFoundException('暂无该期的公开成绩。');
    const [round] = await this.db
      .select()
      .from(rounds)
      .where(eq(rounds.week, week));
    if (!round) throw new NotFoundException('暂无该期的公开成绩。');
    const ranked = contestRankedEntries(
      this.db,
      week,
      Boolean(round.settledAt),
    );
    const publicSeats = this.db
      .select({ id: ranked.cultivatorId })
      .from(ranked)
      .where(lte(ranked.rank, MAX_WEEKLY_REPUTATION_RANK));
    const [record] = await this.db
      .with(ranked)
      .select({
        attempts: entries.attempts,
        startedAt: entries.startedAt,
        standing: entries.standing,
      })
      .from(entries)
      .where(
        and(
          eq(entries.week, week),
          eq(entries.cultivatorId, cultivatorId),
          inArray(entries.cultivatorId, publicSeats),
        ),
      )
      .limit(1);
    if (!record?.standing) {
      throw new NotFoundException('本期暂无该道友的公开成绩。');
    }
    const paper = ContestPaperSchema.parse(round.paper);
    const standing = record.standing;
    const attempt = record.attempts[standing.bestAttempt - 1];
    if (!attempt) throw new NotFoundException('本期暂无该道友的公开成绩。');
    const { effects, qualifiedLots, appearance, toxicity, points, score } =
      attempt;
    return {
      week,
      pillName: paper.question.pillName,
      score: record.standing.score,
      bestAttempt: standing.bestAttempt,
      attemptCount: record.attempts.length,
      materialPoints: standing.materialPoints,
      qiPoints: standing.qiPoints,
      usedMaterials: standing.usedMaterials,
      usedQi: CONTEST_QI - contestBudget(paper.materials, record.attempts).qi,
      elapsedMs: Math.max(
        0,
        Date.parse(attempt.acceptedAt) - record.startedAt.getTime(),
      ),
      result: { effects, qualifiedLots, appearance, toxicity, points, score },
    };
  }
}
