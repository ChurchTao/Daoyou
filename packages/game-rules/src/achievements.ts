import { ACHIEVEMENT_DEFINITIONS } from '@daoyou/game-content/achievements';
import type {
  AchievementDefinition,
  AchievementFacts,
  AchievementUnlockFact,
  AchievementView,
} from '@daoyou/game-domain/achievements';

export function achievementProgress(
  definition: AchievementDefinition,
  facts: AchievementFacts,
) {
  const target = definition.requirement.target;
  if (!Number.isSafeInteger(target) || target <= 0)
    throw new RangeError('成就目标必须为正安全整数');
  const raw = facts.metrics[definition.requirement.metric] ?? 0;
  return {
    current: Math.min(
      target,
      Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0,
    ),
    target,
  };
}

export function eligibleAchievementIds(facts: AchievementFacts): string[] {
  return ACHIEVEMENT_DEFINITIONS.filter((definition) => {
    const progress = achievementProgress(definition, facts);
    return progress.current >= progress.target;
  }).map((definition) => definition.id);
}

export function achievementCatalogue(
  facts: AchievementFacts,
  unlocks: readonly AchievementUnlockFact[],
): AchievementView[] {
  const byId = new Map(unlocks.map((unlock) => [unlock.achievementId, unlock]));
  return ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const unlock = byId.get(definition.id);
    const progress = achievementProgress(definition, facts);
    let name = definition.name;
    if (unlock && definition.nameTemplate) {
      let missingLabel = false;
      const formatted = definition.nameTemplate.replace(
        /\{([A-Za-z][A-Za-z0-9_]*)\}/g,
        (_, key: string) => {
          const label = facts.labels?.[key]?.trim();
          if (!label) missingLabel = true;
          return label ?? '';
        },
      );
      if (!missingLabel && formatted) name = formatted;
    }
    return {
      id: definition.id,
      name,
      description: definition.description,
      condition: definition.condition,
      unlocked: Boolean(unlock),
      unlockedAt: unlock?.unlockedAt ?? null,
      progress: unlock ? { ...progress, current: progress.target } : progress,
    };
  });
}
