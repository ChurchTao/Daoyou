export interface AchievementCondition {
  metric: string;
  target: number;
}

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  condition: string;
  requirement: AchievementCondition;
  nameTemplate?: string;
}

export interface AchievementFacts {
  metrics: Readonly<Record<string, number>>;
  labels?: Readonly<Record<string, string>>;
}

export interface AchievementDisplay {
  id: string;
  name: string;
  description: string;
}

export interface AchievementView extends AchievementDisplay {
  unlocked: boolean;
  unlockedAt: string | null;
  condition: string;
  progress: { current: number; target: number };
}

export interface AchievementUnlockFact {
  achievementId: string;
  unlockedAt: string;
}
