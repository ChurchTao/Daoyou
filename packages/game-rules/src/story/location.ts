import type { StoryView } from '@daoyou/game-domain/story';
import type { MapPlaceRef } from '@daoyou/game-domain/world/map';

export function storyLocationHref(
  location: MapPlaceRef,
  directions = false,
): string {
  if (location.kind === 'sect') {
    return `/game/sect?${new URLSearchParams({ spot: location.spotId })}`;
  }
  return `/game/map-v2?${new URLSearchParams({
    area: location.areaId,
    [directions ? 'from' : 'place']: location.placeId,
  })}`;
}

export function storyPlayHref(
  href: string,
  story: Pick<StoryView, 'chapterId' | 'beatId'>,
): string {
  const target = new URL(href, 'http://story.local');
  target.searchParams.set('chapter', story.chapterId);
  target.searchParams.set('beat', story.beatId);
  return target.pathname + target.search;
}

export function storyPassageMark(beatId: string, passageId: string): string {
  return `passage:${beatId}:${passageId}`;
}
