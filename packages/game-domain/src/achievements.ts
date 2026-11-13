export const ACHIEVEMENT_CATEGORY_IDS = [
  'cultivation',
  'sect',
  'companions',
  'craft',
  'garden',
  'exploration',
  'mentorship',
] as const;

export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORY_IDS)[number];

export interface AchievementAction {
  label: string;
  href: string;
}

export interface AchievementSeriesDefinition {
  id: string;
  name: string;
  category: AchievementCategory;
  unit: string;
  tracking: 'snapshot' | 'counter';
  trackingHint?: string;
  action?: AchievementAction;
}

export interface AchievementCondition {
  metric: string;
  target: number;
}

export interface AchievementDefinition {
  id: string;
  seriesId: string;
  tier: number;
  name: string;
  description: string;
  condition: string;
  requirement: AchievementCondition;
  nameTemplate?: string;
}

export interface AchievementFacts {
  metrics: Readonly<Record<string, number>>;
  labels?: Readonly<Record<string, string>>;
  blockedAchievements?: Readonly<Record<string, string>>;
}

export interface AchievementDisplay {
  id: string;
  name: string;
  description: string;
}

export interface AchievementView extends AchievementDisplay {
  category: AchievementCategory;
  categoryLabel: string;
  seriesId: string;
  seriesName: string;
  tier: number;
  unit: string;
  action?: AchievementAction;
  trackingHint?: string;
  blockedReason?: string;
  unlocked: boolean;
  unlockedAt: string | null;
  condition: string;
  progress: { current: number; target: number };
}

export interface AchievementUnlockFact {
  achievementId: string;
  unlockedAt: string;
}
