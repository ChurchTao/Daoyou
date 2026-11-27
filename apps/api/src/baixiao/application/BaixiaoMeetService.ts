import { CombatV6BuildError } from '@server/combat/application/CombatV6BuildService.js';
import { hasActiveCombat } from '@server/combat/application/CombatOccupancy.js';
import { dungeonPlayer } from '@server/dungeon/combat-player.js';
import type { RealmType } from '@daoyou/constants/realms';
import type { BaixiaoResolveCommand } from '@daoyou/contracts/baixiao/meet';
import {
  BAIXIAO_QUESTION_MS,
  BAIXIAO_SESSION_MS,
  type BaixiaoQuestionData,
} from '@daoyou/game-domain/baixiao/meet';
import {
  awardBaixiaoCard,
  baixiaoCardState,
  baixiaoRewardBudget,
  baixiaoWeek,
  decideBaixiaoAnswer,
  decideBaixiaoCard,
  decideBaixiaoChallenge,
  finishBaixiao,
  scoreBaixiao,
} from '@daoyou/game-rules/baixiao/meet';
import { rewardAttachments } from '@daoyou/game-rules/rewards/materials';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient, DbTransaction } from '@server/lib/drizzle/db.js';
import {
  cultivators,
  baixiaoEntries as entries,
  baixiaoRounds as rounds,
} from '@server/lib/drizzle/schema.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import { MailService } from '@server/mail/application/MailService.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { baixiaoView, readBaixiaoQuestion } from './baixiao-view.js';
import { BaixiaoDuelService } from './BaixiaoDuelService.js';
import { BaixiaoQuestionBank } from './BaixiaoQuestionBank.js';
import {
  grantBaixiaoResources,
  prepareBaixiaoClearReward,
} from './BaixiaoRewards.js';

type ResolveCommand =
  | BaixiaoResolveCommand
  | {
      action: 'challenge-result';
      week: string;
      position: number;
      challengeId: string;
    };

function entryFilter(week: string, actor: ActiveCultivatorRef) {
  return and(eq(entries.week, week), eq(entries.userId, actor.userId));
}

function roundClock(week: string, now = Date.now()) {
  const clock = baixiaoWeek(Date.parse(`${week}T00:00:00+08:00`));
  if (clock.week !== week || now < clock.opensAt)
    throw new ConflictException('该期尚未开放。');
  return clock;
}

@Injectable()
export class BaixiaoMeetService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: DbClient,
    @Inject(BaixiaoQuestionBank) private readonly bank: BaixiaoQuestionBank,
    @Inject(BaixiaoDuelService) private readonly duels: BaixiaoDuelService,
  ) {}

  private async previousSession(actor: ActiveCultivatorRef, now: number) {
    const current = baixiaoWeek(now);
    if (now >= current.opensAt + BAIXIAO_SESSION_MS) return undefined;
    const clock = baixiaoWeek(now, -1);
    const [entry] = await this.db
      .select()
      .from(entries)
      .where(
        and(
          entryFilter(clock.week, actor),
          eq(entries.cultivatorId, actor.cultivatorId),
          isNull(entries.status),
          gt(entries.endsAt, new Date(now)),
        ),
      );
    return entry ? { clock, entry } : undefined;
  }

  async status(actor: ActiveCultivatorRef) {
    const now = Date.now();
    const ongoing = await this.previousSession(actor, now);
    if (ongoing)
      return baixiaoView(
        this.db,
        ongoing.clock,
        now,
        actor,
        { settledAt: null },
        ongoing.entry,
      );

    const clock = baixiaoWeek(now);
    const [[entry], [round]] = await Promise.all([
      this.db.select().from(entries).where(entryFilter(clock.week, actor)),
      this.db
        .select({ settledAt: rounds.settledAt })
        .from(rounds)
        .where(eq(rounds.week, clock.week)),
    ]);
    const canStart =
      !entry && round && now >= clock.opensAt && now < clock.closesAt;
    const availableRound =
      canStart && !(await this.bank.isReady()) ? undefined : round;
    return baixiaoView(
      this.db,
      clock,
      Date.now(),
      actor,
      availableRound,
      entry,
    );
  }

  async start(week: string, actor: ActiveCultivatorRef) {
    const now = Date.now();
    const clock = baixiaoWeek(now);
    if (week !== clock.week)
      throw new ConflictException('期次已更新，请刷新赛况。');
    if (await this.previousSession(actor, now))
      throw new ConflictException('请先完成上周已开局的挑战。');
    const [registered] = await this.db
      .select()
      .from(entries)
      .where(entryFilter(week, actor));
    if (registered) return this.status(actor);
    const round = await this.bank.prepare(clock);
    if (!round) throw new ConflictException('本期题卷仍在准备，请稍后再来。');
    const [character] = await this.db
      .select({
        id: cultivators.id,
        name: cultivators.name,
        title: cultivators.title,
        gender: cultivators.gender,
        realm: cultivators.realm,
      })
      .from(cultivators)
      .where(
        and(
          eq(cultivators.id, actor.cultivatorId),
          eq(cultivators.userId, actor.userId),
          eq(cultivators.status, 'active'),
        ),
      );
    if (!character) throw new ForbiddenException('当前角色不可参赛。');
    const realm = character.realm as RealmType;
    const paper = await this.bank.drawPaper();
    await this.db.transaction(async (tx) => {
      const [period] = await tx
        .select({ settledAt: rounds.settledAt, closesAt: rounds.closesAt })
        .from(rounds)
        .where(eq(rounds.week, week))
        .for('share');
      const startedAt = Date.now();
      if (!period || period.settledAt || startedAt >= period.closesAt.getTime())
        throw new ConflictException('本期已截止入场。');
      await tx
        .insert(entries)
        .values({
          week,
          userId: actor.userId,
          cultivatorId: actor.cultivatorId,
          name: character.name,
          title: character.title,
          gender: character.gender,
          realm,
          endsAt: new Date(startedAt + BAIXIAO_SESSION_MS),
          paper,
          budget: baixiaoRewardBudget(realm),
          earned: { cultivationExp: 0, spiritStones: 0, insight: 0 },
        })
        .onConflictDoNothing();
    });
    return this.status(actor);
  }

  private async lockEntry(
    tx: DbTransaction,
    week: string,
    actor: ActiveCultivatorRef,
  ) {
    const [entry] = await tx
      .select()
      .from(entries)
      .where(entryFilter(week, actor))
      .for('update');
    if (!entry) throw new ConflictException('请先入场参赛。');
    if (entry.cultivatorId !== actor.cultivatorId)
      throw new ForbiddenException('请使用本期入场的角色继续。');
    return entry;
  }

  next(week: string, position: number, actor: ActiveCultivatorRef) {
    const clock = roundClock(week);
    return this.db.transaction(async (tx) => {
      let entry = await this.lockEntry(tx, week, actor);
      const now = Date.now();
      if (now >= entry.endsAt.getTime() || entry.status) {
        return baixiaoView(tx, clock, now, actor, undefined, entry);
      }
      if (position !== entry.answers.length)
        throw new ConflictException('题序已更新，请重新读取赛况。');
      let activeQuestion: BaixiaoQuestionData | undefined;
      if (!entry.issuedAt && !entry.challengeId) {
        activeQuestion = await readBaixiaoQuestion(tx, entry.paper[position]);
        const issuedAt = Date.now();
        if (issuedAt >= entry.endsAt.getTime())
          return baixiaoView(tx, clock, issuedAt, actor, undefined, entry);
        [entry] = await tx
          .update(entries)
          .set({ issuedAt: new Date(issuedAt) })
          .where(entryFilter(week, actor))
          .returning();
      }
      return baixiaoView(
        tx,
        clock,
        Date.now(),
        actor,
        { settledAt: null },
        entry,
        { active: activeQuestion },
      );
    });
  }

  async recoverChallenge(actor: ActiveCultivatorRef, challengeId: string) {
    const now = Date.now();
    const [entry] = await this.db
      .select({
        week: entries.week,
        cultivatorId: entries.cultivatorId,
        challengeId: entries.challengeId,
        answers: entries.answers,
      })
      .from(entries)
      .where(
        and(
          eq(entries.userId, actor.userId),
          eq(entries.challengeId, challengeId),
          inArray(entries.week, [
            baixiaoWeek(now).week,
            baixiaoWeek(now, -1).week,
          ]),
        ),
      );
    if (
      !entry ||
      entry.cultivatorId !== actor.cultivatorId ||
      entry.challengeId !== challengeId
    )
      return true;
    const status = await this.resolve(
      {
        action: 'challenge-result',
        week: entry.week,
        position: entry.answers.length,
        challengeId,
      },
      actor,
    );
    return status.session?.challengeId !== challengeId;
  }

  async resolve(command: ResolveCommand, actor: ActiveCultivatorRef) {
    const receivedAt = Date.now();
    const clock = roundClock(command.week, receivedAt);
    const { result } = await playerCommandExecutor.execute({
      ...actor,
      source: 'baixiao.answer',
      coordination: { mode: 'database-only' },
      allowEmpty: true,
      command: async (tx) => {
        const entry = await this.lockEntry(tx, command.week, actor);
        const now = Date.now();
        const unchanged = async (current = entry) => {
          return {
            result: {
              status: await baixiaoView(
                tx,
                clock,
                now,
                actor,
                { settledAt: null },
                current,
              ),
              mail: null,
            },
            resourceChanges: [],
          };
        };
        const endsAt = entry.endsAt.getTime();
        const canSettleChallenge =
          command.action === 'challenge-result' &&
          command.position === entry.answers.length &&
          command.challengeId === entry.challengeId;
        const settlingChallenge = canSettleChallenge ? entry.challengeId : null;
        if (entry.status || (receivedAt >= endsAt && !settlingChallenge))
          return unchanged();
        if (command.position < entry.answers.length) return unchanged();
        if (
          entry.answers.length !== command.position ||
          !entry.issuedAt ||
          receivedAt < entry.issuedAt.getTime()
        ) {
          throw new ConflictException('该题尚未开启，请重新读取赛况。');
        }
        const issuedAt = entry.issuedAt.getTime();
        const timedOut = receivedAt >= issuedAt + BAIXIAO_QUESTION_MS;
        if (command.action === 'focus') {
          if (
            entry.challengeId ||
            timedOut ||
            command.endsAt !== endsAt ||
            command.expectedFocusPenalties !== entry.focusPenalties
          )
            return unchanged();
          const focusPenalties = entry.focusPenalties + 1;
          const [updated] = await tx
            .update(entries)
            .set({
              focusPenalties,
              score: scoreBaixiao(entry.answers, focusPenalties),
            })
            .where(entryFilter(command.week, actor))
            .returning();
          return unchanged(updated);
        }
        const { hand, streak } = baixiaoCardState(entry.answers);
        let adjudicated;
        let answeredQuestion: BaixiaoQuestionData | undefined;
        if (settlingChallenge) {
          const result = await this.duels.result(actor, settlingChallenge, tx);
          if (
            result.state === 'active' ||
            (result.state === 'finished' && result.completedAt >= endsAt) ||
            (result.state === 'missing' && receivedAt >= endsAt)
          )
            return unchanged();
          adjudicated = decideBaixiaoChallenge(
            result.state === 'finished' && result.victory,
          );
        } else if (entry.challengeId || command.action === 'challenge-result') {
          return unchanged();
        } else if (command.action === 'card' && !timedOut) {
          if (!hand[command.card])
            throw new ConflictException('这张对策卡已用完。');
          if (command.card === 'challenge') {
            if (await hasActiveCombat(actor.cultivatorId, { executor: tx }))
              throw new ConflictException('请先结束当前战斗与结算。');
            const { player } = await dungeonPlayer(actor.cultivatorId, tx).catch((cause: unknown) => {
              if (cause instanceof CombatV6BuildError)
                throw new ConflictException('当前角色无法出战，可继续作答或使用其他对策卡。');
              throw cause;
            });
            await tx.update(cultivators).set({ condition: player.cultivator.condition })
              .where(eq(cultivators.id, actor.cultivatorId));
            const id = await this.duels.create(player, endsAt, {
              actor,
              week: command.week,
              position: command.position,
            });
            const [challenging] = await tx
              .update(entries)
              .set({ challengeId: id })
              .where(entryFilter(command.week, actor))
              .returning();
            return unchanged(challenging);
          }
          adjudicated = decideBaixiaoCard(
            command.card,
            issuedAt,
            receivedAt,
            randomInt,
          );
        } else if (command.action === 'answer' && !timedOut) {
          const slot = entry.paper[command.position];
          const selected = slot.order[command.option];
          if (selected === undefined)
            throw new BadRequestException('所选答案不在本题选项中。');
          answeredQuestion = await readBaixiaoQuestion(tx, slot);
          adjudicated = decideBaixiaoAnswer(
            issuedAt,
            receivedAt,
            selected,
            answeredQuestion.correct,
          );
        } else {
          if (command.action === 'timeout' && !timedOut) return unchanged();
          adjudicated = decideBaixiaoAnswer(issuedAt, receivedAt, 0, 0);
        }
        const answer = awardBaixiaoCard(streak, adjudicated, randomInt);
        const answers = [...entry.answers, answer];
        const score = scoreBaixiao(answers, entry.focusPenalties);
        const status = finishBaixiao(score);
        let completion;
        if (status === 'cleared') {
          const [round] = await tx
            .select()
            .from(rounds)
            .where(eq(rounds.week, command.week));
          completion = await prepareBaixiaoClearReward(
            tx,
            round,
            entry.realm,
            score.correct,
          );
        }
        const correct = answer.verdict === 'correct';
        const { earned, resourceChanges } =
          correct || completion
            ? await grantBaixiaoResources(
                tx,
                actor,
                entry,
                score.correct - Number(correct),
                score.correct,
                completion,
              )
            : { earned: entry.earned, resourceChanges: [] };
        if (settlingChallenge) resourceChanges.push({
          resourceTopic: 'player.condition', operation: 'invalidate', eventType: 'baixiao.battle.settled',
        });
        let mail = null;
        if (completion) {
          mail = await MailService.sendNewRewardMail(
            actor.cultivatorId,
            '百晓盛会通关奖励',
            '道友闯过百晓盛会二十五关，盛会将所获随信奉上。',
            rewardAttachments(
              completion.reward.items.map((inventory) => ({
                type: 'inventory_v1',
                inventory,
              })),
            ),
            'reward',
            tx,
          );
        }
        const [updated] = await tx
          .update(entries)
          .set({
            answers,
            score,
            issuedAt: null,
            challengeId: null,
            status,
            earned,
            reward: completion?.reward ?? null,
          })
          .where(entryFilter(command.week, actor))
          .returning();
        return {
          result: {
            status: await baixiaoView(
              tx,
              clock,
              Date.now(),
              actor,
              { settledAt: null },
              updated,
              { answered: answeredQuestion },
            ),
            mail,
          },
          resourceChanges,
        };
      },
    });
    if (result.mail)
      publishTransactionalMessageBestEffort(result.mail.domainEventId, {
        source: 'baixiao-reward',
        mailId: result.mail.id,
      });
    return result.status;
  }
}
