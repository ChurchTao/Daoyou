export function formatScore(score: number | null | undefined): string {
  const value =
    typeof score === 'number' && Number.isFinite(score)
      ? Math.max(1, Math.round(score))
      : 0;
  return `评分 ${value}`;
}
