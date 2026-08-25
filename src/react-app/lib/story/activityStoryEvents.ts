export const ACTIVITY_STORY_REFRESH_EVENT = 'activity-story:refresh';

export function requestActivityStoryRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(ACTIVITY_STORY_REFRESH_EVENT));
}
