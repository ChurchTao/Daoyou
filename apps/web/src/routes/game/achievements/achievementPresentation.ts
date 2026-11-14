import type { AchievementView } from '@daoyou/contracts/achievements';

export interface AchievementSeries {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  items: AchievementView[];
}

export function groupAchievementSeries(
  achievements: readonly AchievementView[],
) {
  const byId = new Map<string, AchievementSeries>();
  for (const achievement of achievements) {
    const series = byId.get(achievement.seriesId);
    if (series) series.items.push(achievement);
    else
      byId.set(achievement.seriesId, {
        id: achievement.seriesId,
        name: achievement.seriesName,
        category: achievement.category,
        categoryLabel: achievement.categoryLabel,
        items: [achievement],
      });
  }
  return [...byId.values()].map((series) => ({
    ...series,
    items: series.items.sort((left, right) => left.tier - right.tier),
  }));
}

export function isAwaitingRecord(achievement: AchievementView) {
  return (
    !achievement.unlocked &&
    !achievement.blockedReason &&
    achievement.progress.current >= achievement.progress.target
  );
}

export function achievementRatio(achievement: AchievementView) {
  if (!achievement.unit || achievement.progress.target <= 1) return 0;
  return Math.min(
    1,
    Math.max(0, achievement.progress.current / achievement.progress.target),
  );
}

export function achievementDate(value: string | null) {
  if (!value) return '日期未记';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '日期未记';
}
