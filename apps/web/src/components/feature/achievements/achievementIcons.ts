import type { AchievementView } from '@daoyou/contracts/achievements';

const categoryIcons: Readonly<Record<string, string>> = {
  cultivation: '🧘',
  sect: '🏯',
  companions: '🐾',
  craft: '🔥',
  garden: '🌱',
  exploration: '🧭',
  mentorship: '🎓',
};

const seriesIcons: Readonly<Record<string, string>> = {
  'cultivation.realm': '🪷',
  'manuals.level': '📖',
  'body.level': '💪',
  'sect_methods.level': '🏯',
  'beasts.level': '🐾',
  'beasts.fusions': '🔮',
  'alchemy.crafts': '⚗️',
  'forging.equipment': '⚒️',
  'spirit_field.harvests': '🌾',
  'exploration.claims': '🧭',
  'dungeon.completions': '🗝️',
  'mentorship.apprentice': '🎓',
  'mentorship.graduates': '🍑',
};

const achievementIcons: Readonly<Record<string, string>> = {
  'cultivation.realm.1': '🌱',
  'cultivation.realm.2': '🔆',
  'cultivation.realm.3': '🪷',
  'cultivation.realm.4': '✨',
  'cultivation.realm.5': '🌌',
  'cultivation.realm.6': '☯️',
  'cultivation.realm.7': '🌠',
  'cultivation.realm.8': '⚡',
  'manuals.level.1': '📖',
  'manuals.level.6': '📚',
  'manuals.level.9': '📜',
  'body.level.10': '🦴',
  'body.level.20': '💪',
  'body.level.30': '⛰️',
  'sect_methods.level.20': '🏮',
  'sect_methods.level.60': '🏯',
  'sect_methods.level.100': '🏔️',
  'beasts.level.10': '🐾',
  'beasts.level.30': '🐺',
  'beasts.level.60': '🐉',
  'beasts.fusions.1': '🥚',
  'beasts.fusions.10': '🔮',
  'beasts.fusions.30': '☯️',
  'alchemy.crafts.1': '🕯️',
  'alchemy.crafts.10': '🔥',
  'alchemy.crafts.50': '⚗️',
  'forging.equipment.1': '⚒️',
  'forging.equipment.10': '🔨',
  'forging.equipment.50': '⚔️',
  'spirit_field.harvests.1': '🌱',
  'spirit_field.harvests.10': '🌿',
  'spirit_field.harvests.50': '🌾',
  'exploration.claims.1': '🧭',
  'exploration.claims.20': '🗺️',
  'exploration.claims.100': '🌏',
  'dungeon.completions.1': '🚪',
  'dungeon.completions.10': '🗝️',
  'dungeon.completions.50': '🏔️',
  'mentorship.apprentice': '🎓',
  'mentorship.graduates.2': '🌱',
  'mentorship.graduates.6': '📖',
  'mentorship.graduates.12': '🕯️',
  'mentorship.graduates.20': '🌳',
  'mentorship.graduates.30': '🍑',
};

export function achievementCategoryIcon(category: string): string {
  return categoryIcons[category] ?? '🏅';
}

export function achievementIcon(
  achievement: Pick<AchievementView, 'id' | 'seriesId' | 'category'>,
): string {
  return (
    achievementIcons[achievement.id] ??
    seriesIcons[achievement.seriesId] ??
    achievementCategoryIcon(achievement.category)
  );
}
