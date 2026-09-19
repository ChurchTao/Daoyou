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
