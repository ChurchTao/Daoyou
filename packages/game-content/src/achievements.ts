import type { AchievementDefinition } from '@daoyou/game-domain/achievements';

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  {
    id: 'mentorship.apprentice',
    name: '师承有道',
    description: '铭记引你入道的师承。',
    condition: '与一位师父正式结为师徒',
    requirement: { metric: 'mentorship.bound', target: 1 },
    nameTemplate: '{mentorName}之徒',
  },
  ...(
    [
      [2, '为人师表'],
      [6, '循循善诱'],
      [12, '诲人不倦'],
      [20, '厚德树人'],
      [30, '桃李天下'],
    ] as const
  ).map(([count, name]): AchievementDefinition => ({
    id: `mentorship.graduates.${count}`,
    name,
    description: `已培养 ${count} 位弟子成功出师。`,
    condition: `累计培养 ${count} 位弟子成功出师`,
    requirement: { metric: 'mentorship.graduated_disciples', target: count },
  })),
];

export function findAchievementDefinition(
  id: string,
): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find((definition) => definition.id === id);
}
