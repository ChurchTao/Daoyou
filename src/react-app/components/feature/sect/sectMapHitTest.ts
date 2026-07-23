import type { SectMapHotspot } from '@shared/engine/sect';

export function resolveClosestSectMapHotspot(
  hotspots: readonly SectMapHotspot[],
  pointer: { x: number; y: number },
  canvas: { width: number; height: number },
): SectMapHotspot | undefined {
  let closest: SectMapHotspot | undefined;
  let closestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const hotspot of hotspots) {
    const x = (Number.parseFloat(hotspot.left) / 100) * canvas.width;
    const y = (Number.parseFloat(hotspot.top) / 100) * canvas.height;
    const distanceSquared = (pointer.x - x) ** 2 + (pointer.y - y) ** 2;

    if (distanceSquared < closestDistanceSquared) {
      closest = hotspot;
      closestDistanceSquared = distanceSquared;
    }
  }

  return closest;
}
