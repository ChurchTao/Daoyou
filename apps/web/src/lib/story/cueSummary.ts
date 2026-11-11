import type { StoryView } from '@daoyou/game-domain/story';

/** 当前目标的一句话：提示，加上各条目标做到哪了。 */
export function storyCueSummary(story: StoryView): string {
  if (story.goals.length === 0) return story.prompt;
  const goals = story.goals.map((goal) =>
    goal.done
      ? `${goal.label}（已完成）`
      : goal.target === null
        ? goal.label
        : `${goal.label}（${goal.current ?? 0}/${goal.target}）`,
  );
  return `${story.prompt} ${goals.join('；')}`;
}
