import type {
  BaixiaoPhase,
  BaixiaoQuestionView,
  BaixiaoStatus,
} from '@daoyou/contracts/baixiao/meet';
import { BAIXIAO_QUESTION_MS } from '@daoyou/game-domain/baixiao/meet';
import {
  baixiaoCardState,
  type baixiaoWeek,
  scoreBaixiao,
} from '@daoyou/game-rules/baixiao/meet';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type {
  baixiaoEntries,
  baixiaoRounds,
} from '@server/lib/drizzle/schema.js';

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

export function baixiaoQuestionDeadline(entry: Entry) {
  return Math.min(
    (entry.issuedAt?.getTime() ?? 0) + BAIXIAO_QUESTION_MS,
    entry.endsAt.getTime(),
  );
}

export function baixiaoView(
  clock: Clock,
  now: number,
  actor: ActiveCultivatorRef,
  round?: Pick<Round, 'settledAt'>,
  entry?: Entry,
  question: BaixiaoQuestionView | null = null,
): BaixiaoStatus {
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
  return {
    ...clock,
    phase: baixiaoPhase(clock, now, round),
    serverTime: now,
    otherCharacter,
    session: player
      ? {
          endsAt: player.endsAt.getTime(),
          position: player.answers.length,
          question: finished ? null : question,
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
