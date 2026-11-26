import { RANKING_REWARDS } from '@daoyou/game-content/economy';

export const MAX_DAILY_RANKING_CHALLENGES = 30;
export const MAX_WEEKLY_REPUTATION_RANK = 100;

export function weeklyReputationForRank(rank: number): number {
  if (!Number.isInteger(rank) || rank < 1 || rank > MAX_WEEKLY_REPUTATION_RANK)
    return 0;
  if (rank === 1) return RANKING_REWARDS[1];
  if (rank <= 10) return RANKING_REWARDS['2-10'];
  if (rank <= 50) return RANKING_REWARDS['11-50'];
  return RANKING_REWARDS['51-100'];
}

/** Day ownership is fixed at acceptance, independent of the server timezone. */
export function rankingDay(now: number) {
  return new Date(now + 8 * 3600000).toISOString().slice(0, 10);
}
export function rankingOrderAfterBattle(
  order: string[],
  challenger: string,
  target: string,
  won: boolean,
  affectsRanking: boolean,
) {
  const next = [...order];
  const targetIndex = order.indexOf(target);
  const ownIndex = order.indexOf(challenger);
  let change: 'challenge_win' | 'vacancy_entry' | null = null;
  if (affectsRanking && targetIndex >= 0) {
    if (won && (ownIndex < 0 || ownIndex > targetIndex)) {
      if (ownIndex >= 0) next.splice(ownIndex, 1);
      next.splice(targetIndex, 0, challenger);
      next.splice(100);
      change = 'challenge_win';
    } else if (!won && ownIndex < 0 && next.length < 100) {
      next.push(challenger);
      change = 'vacancy_entry';
    }
  }
  return {
    order: next,
    challengerRank: next.includes(challenger)
      ? next.indexOf(challenger) + 1
      : null,
    targetRank: next.includes(target) ? next.indexOf(target) + 1 : null,
    change,
  };
}
