import type { StoryView } from '@daoyou/game-domain/story';

/**
 * 新手期主线的下一步是不是在别的页面上。
 * 是的话，眼下这一页要留一句话把人领过去。
 */
export function storyLeadsElsewhere(
  story: StoryView | null | undefined,
  pathname: string,
): story is StoryView {
  if (!story?.unlocked || !story.prompt || story.kind === 'life') return false;
  return new URL(story.href, 'http://story.local').pathname !== pathname;
}
