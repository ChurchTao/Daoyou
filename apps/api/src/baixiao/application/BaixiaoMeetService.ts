import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import type {
  BaixiaoQuestionView,
  BaixiaoResolveCommand,
} from '@daoyou/contracts/baixiao/meet';
import {
  BAIXIAO_QUESTION_MS,
  BAIXIAO_SESSION_MS,
} from '@daoyou/game-domain/baixiao/meet';
import { BaixiaoQuestionSchema } from '@daoyou/game-domain/baixiao/question';
import {
  awardBaixiaoCard,
  baixiaoCardState,
  baixiaoRewardBudget,
  baixiaoWeek,
  createBaixiaoPaper,
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
import {
  assembleCombatV6WildPlayer,
  CombatV6BuildError,
} from '@server/combat/application/CombatV6BuildService.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type {
  DbClient,
  DbExecutor,
  DbTransaction,
} from '@server/lib/drizzle/db.js';
import {
  cultivators,
  baixiaoEntries as entries,
  baixiaoQuestions as questions,
  baixiaoRounds as rounds,
} from '@server/lib/drizzle/schema.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import { MailService } from '@server/mail/application/MailService.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { and, eq } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import {
  baixiaoQuestionDeadline,
  baixiaoView,
  type Entry,
} from './baixiao-view.js';
import { BaixiaoDuelService } from './BaixiaoDuelService.js';
import { BaixiaoQuestionBank, loadBaixiaoBank } from './BaixiaoQuestionBank.js';
import { drawBaixiaoReward, grantBaixiaoAnswer } from './BaixiaoRewards.js';

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

function currentWeek(week: string, now = Date.now()) {
  const clock = baixiaoWeek(now);
  if (week !== clock.week)
    throw new ConflictException('期次已更新，请返回查看赛程。');
  return clock;
}

async function questionView(
  tx: DbExecutor,
  entry?: Entry,
): Promise<BaixiaoQuestionView | null> {
  if (!entry?.issuedAt || entry.status || entry.challengeId) return null;
  const position = entry.answers.length;
  const slot = entry.paper[position];
  const [row] = await tx
    .select({ question: questions.question })
    .from(questions)
    .where(eq(questions.id, slot.questionId));
  const question = BaixiaoQuestionSchema.parse(row?.question);
  return {
    position,
    prompt: question.prompt,
    kind: question.kind,
    options: slot.order.map((index) => question.options[index]),
    deadline: baixiaoQuestionDeadline(entry),
  };
}

@Injectable()
export class BaixiaoMeetService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: DbClient,
    @Inject(BaixiaoQuestionBank) private readonly bank: BaixiaoQuestionBank,
    @Inject(BaixiaoDuelService) private readonly duels: BaixiaoDuelService,
  ) {}

  async status(actor: ActiveCultivatorRef) {
    const now = Date.now();
    const clock = baixiaoWeek(now);
    const [[entry], [round]] = await Promise.all([
      this.db.select().from(entries).where(entryFilter(clock.week, actor)),
      this.db
        .select({ settledAt: rounds.settledAt })
        .from(rounds)
        .where(eq(rounds.week, clock.week)),
    ]);
    const question =
      entry?.cultivatorId === actor.cultivatorId && now < entry.endsAt.getTime()
        ? await questionView(this.db, entry)
        : null;
    return baixiaoView(clock, Date.now(), actor, round, entry, question);
  }

  async start(week: string, actor: ActiveCultivatorRef) {
    const now = Date.now();
    const clock = currentWeek(week, now);
    if (now < clock.opensAt || now > clock.lastStartAt)
      throw new ConflictException('当前时段不可入场。');
    const [registered] = await this.db
      .select()
      .from(entries)
      .where(entryFilter(week, actor));
    if (registered) return this.status(actor);
    const round = await this.bank.prepare(clock);
    if (!round) throw new ConflictException('本期题卷仍在准备，请稍后再来。');
    const [bank, [character]] = await Promise.all([
      loadBaixiaoBank(this.db, round.questionIds),
      this.db
        .select({
          id: cultivators.id,
          name: cultivators.name,
          title: cultivators.title,
          gender: cultivators.gender,
          realm: cultivators.realm,
          stage: cultivators.realm_stage,
        })
        .from(cultivators)
        .where(
          and(
            eq(cultivators.id, actor.cultivatorId),
            eq(cultivators.userId, actor.userId),
            eq(cultivators.status, 'active'),
          ),
        ),
    ]);
    if (!character) throw new ForbiddenException('当前角色不可参赛。');
    const paper = createBaixiaoPaper(bank, randomInt);
    if (!paper) throw new ConflictException('本期题库暂未达到组卷要求。');
    const startedAt = Date.now();
    if (startedAt > clock.lastStartAt)
      throw new ConflictException('本期已截止入场。');
    await this.db
      .insert(entries)
      .values({
        week,
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
        name: character.name,
        title: character.title,
        gender: character.gender,
        realm: character.realm,
        endsAt: new Date(startedAt + BAIXIAO_SESSION_MS),
        paper,
        budget: baixiaoRewardBudget(
          character.realm as RealmType,
          character.stage as RealmStage,
        ),
        earned: { cultivationExp: 0, spiritStones: 0, insight: 0 },
      })
      .onConflictDoNothing();
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
    const clock = currentWeek(week);
    return this.db.transaction(async (tx) => {
      let entry = await this.lockEntry(tx, week, actor);
      const now = Date.now();
      if (now >= entry.endsAt.getTime() || entry.status) {
        return baixiaoView(clock, now, actor, undefined, entry);
      }
      if (position !== entry.answers.length)
        throw new ConflictException('题序已更新，请重新读取赛况。');
      if (!entry.issuedAt && !entry.challengeId) {
        [entry] = await tx
          .update(entries)
          .set({ issuedAt: new Date(now) })
          .where(entryFilter(week, actor))
          .returning();
      }
      return baixiaoView(
        clock,
        Date.now(),
        actor,
        { settledAt: null },
        entry,
        await questionView(tx, entry),
      );
    });
  }

  async resolve(command: ResolveCommand, actor: ActiveCultivatorRef) {
    const receivedAt = Date.now();
    const clock = currentWeek(command.week, receivedAt);
    const { result } = await playerCommandExecutor.execute({
      ...actor,
      source: 'baixiao.answer',
      coordination: { mode: 'database-only' },
      allowEmpty: true,
      command: async (tx) => {
        const entry = await this.lockEntry(tx, command.week, actor);
        const now = Date.now();
        const unchanged = async (current = entry, withQuestion = true) => {
          return {
            result: {
              status: baixiaoView(
                clock,
                now,
                actor,
                { settledAt: null },
                current,
                withQuestion ? await questionView(tx, current) : null,
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
          return unchanged(entry, false);
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
        const { hand, streak } = baixiaoCardState(entry.answers);
        let adjudicated;
        if (settlingChallenge) {
          const result = await this.duels.result(actor, settlingChallenge);
          if (!result || result.completedAt >= endsAt) return unchanged();
          adjudicated = decideBaixiaoChallenge(result.victory);
        } else if (entry.challengeId || command.action === 'challenge-result') {
          return unchanged();
        } else if (command.action === 'card' && !timedOut) {
          if (!hand[command.card])
            throw new ConflictException('这张对策卡已用完。');
          if (command.card === 'challenge') {
            const { player } = await assembleCombatV6WildPlayer(
              actor.cultivatorId,
              tx,
            ).catch((cause: unknown) => {
              if (cause instanceof CombatV6BuildError)
                throw new ConflictException(
                  '当前角色无法出战，可继续作答或使用其他对策卡。',
                );
              throw cause;
            });
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
            return unchanged(challenging, false);
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
          const [row] = await tx
            .select({ question: questions.question })
            .from(questions)
            .where(eq(questions.id, slot.questionId));
          const question = BaixiaoQuestionSchema.parse(row?.question);
          adjudicated = decideBaixiaoAnswer(
            issuedAt,
            receivedAt,
            selected,
            question.correct,
          );
        } else {
          if (command.action === 'timeout' && !timedOut) return unchanged();
          adjudicated = decideBaixiaoAnswer(issuedAt, receivedAt, null, 0);
        }
        const answer = awardBaixiaoCard(streak, adjudicated, randomInt);
        const answers = [...entry.answers, answer];
        const score = scoreBaixiao(answers);
        const status = finishBaixiao(score);
        const { earned, resourceChanges } =
          answer.verdict === 'correct'
            ? await grantBaixiaoAnswer(
                tx,
                actor,
                entry.budget,
                entry.earned,
                score.correct,
              )
            : { earned: entry.earned, resourceChanges: [] };
        let reward = null;
        let mail = null;
        if (status === 'cleared') {
          const [round] = await tx
            .select()
            .from(rounds)
            .where(eq(rounds.week, command.week));
          reward = drawBaixiaoReward(round);
          mail = await MailService.sendNewRewardMail(
            actor.cultivatorId,
            '百晓盛会通关奖励',
            '道友闯过百晓盛会二十五关，盛会将所获随信奉上。',
            rewardAttachments([
              { type: 'inventory_v1', inventory: reward.item },
            ]),
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
            reward,
          })
          .where(entryFilter(command.week, actor))
          .returning();
        return {
          result: {
            status: baixiaoView(
              clock,
              Date.now(),
              actor,
              { settledAt: null },
              updated,
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
