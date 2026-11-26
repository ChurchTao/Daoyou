import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import { getMapAreaContent } from '@daoyou/game-content/world/map';
import type { MapPlaceRef } from '@daoyou/game-domain/world/map';

export function storyMapPlaceName(
  location: MapPlaceRef | undefined,
  sectId?: string | null,
) {
  if (location?.kind === 'area') {
    return getMapAreaContent(location.areaId)?.places.find(
      ({ id }) => id === location.placeId,
    )?.name;
  }
  if (location?.kind === 'sect' && sectId) {
    return getSectPresentation(sectId).map.hotspots.find(
      ({ id }) => id === location.spotId,
    )?.label;
  }
  return undefined;
}
