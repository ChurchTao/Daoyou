import type {
  BaixiaoPhase,
  BaixiaoQuestionReview,
  BaixiaoQuestionView,
  BaixiaoStatus,
} from '@daoyou/contracts/baixiao/meet';
import {
  BAIXIAO_QUESTION_MS,
  type BaixiaoPaperSlot,
  type BaixiaoQuestionData,
} from '@daoyou/game-domain/baixiao/meet';
import { BaixiaoQuestionSchema } from '@daoyou/game-domain/baixiao/question';
import {
  baixiaoCardState,
  scoreBaixiao,
  type baixiaoWeek,
} from '@daoyou/game-rules/baixiao/meet';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbExecutor } from '@server/lib/drizzle/db.js';
import {
  baixiaoQuestions,
  type baixiaoEntries,
  type baixiaoRounds,
} from '@server/lib/drizzle/schema.js';
import { eq } from 'drizzle-orm';

export type Clock = ReturnType<typeof baixiaoWeek>;
export type Entry = typeof baixiaoEntries.$inferSelect;
export type Round = typeof baixiaoRounds.$inferSelect;

export function baixiaoPhase(
  clock: Clock,
  now: number,
  round?: Pick<Round, 'settledAt'>,
): BaixiaoPhase {
  if (now < clock.opensAt) return 'waiting';
  if (now >= clock.closesAt) return round?.settledAt ? 'settled' : 'closed';
  if (now > clock.lastStartAt) return 'closing';
  return round ? 'open' : 'unavailable';
}

function baixiaoQuestionDeadline(entry: Entry) {
  return Math.min(
    (entry.issuedAt?.getTime() ?? 0) + BAIXIAO_QUESTION_MS,
    entry.endsAt.getTime(),
  );
}

export async function readBaixiaoQuestion(
  tx: DbExecutor,
  slot: BaixiaoPaperSlot,
) {
  const [row] = await tx
    .select({ question: baixiaoQuestions.question })
    .from(baixiaoQuestions)
    .where(eq(baixiaoQuestions.id, slot.questionId));
  return BaixiaoQuestionSchema.parse(row?.question);
}

function questionHeading(question: BaixiaoQuestionData, position: number) {
  const { prompt, category, difficulty } = question;
  return { position, prompt, category, difficulty };
}

export async function baixiaoView(
  tx: DbExecutor,
  clock: Clock,
  now: number,
  actor: ActiveCultivatorRef,
  round?: Pick<Round, 'settledAt'>,
  entry?: Entry,
  answeredQuestion?: BaixiaoQuestionData,
): Promise<BaixiaoStatus> {
  const otherCharacter = Boolean(
    entry && entry.cultivatorId !== actor.cultivatorId,
  );
  const player = otherCharacter ? undefined : entry;
  const score =
    player?.score ??
    scoreBaixiao(player?.answers ?? [], player?.focusPenalties);
  const last = player?.answers.at(-1);
  const cards = baixiaoCardState(player?.answers ?? []);
  const finished =
    player?.status ??
    (player && now >= player.endsAt.getTime() ? 'expired' : null);
  const challengeId = finished ? null : (player?.challengeId ?? null);
  if (challengeId) cards.hand.challenge--;
  const position = player?.answers.length ?? 0;
  let question: BaixiaoQuestionView | null = null;
  let review: BaixiaoQuestionReview | null = null;
  if (player?.issuedAt && !finished && !challengeId) {
    const slot = player.paper[position];
    const active = await readBaixiaoQuestion(tx, slot);
    question = {
      ...questionHeading(active, position),
      kind: active.kind,
      options: slot.order.map((index) => active.options[index]),
      deadline: baixiaoQuestionDeadline(player),
    };
  } else if (
    player &&
    !player.issuedAt &&
    !challengeId &&
    last &&
    last.verdict !== 'correct'
  ) {
    const reviewed =
      answeredQuestion ??
      (await readBaixiaoQuestion(tx, player.paper[position - 1]));
    review = {
      ...questionHeading(reviewed, position - 1),
      verdict: last.verdict,
      answer: reviewed.options[reviewed.correct],
      explanation: reviewed.explanation,
    };
  }
  return {
    ...clock,
    phase: baixiaoPhase(clock, now, round),
    serverTime: now,
    otherCharacter,
    session: player
      ? {
          endsAt: player.endsAt.getTime(),
          position,
          question,
          review,
          challengeId,
          ...cards,
          latest: last
            ? { ...last, position: player.answers.length - 1 }
            : null,
          finished,
          score,
          earned: player.earned,
          itemName: player.reward?.name ?? null,
        }
      : null,
  };
}
