import { useStorySurface } from '@app/lib/hooks/useStorySurface';
import type { StorySurfaceBlackMarketEntry } from '@shared/types/story';

export function useStoryBlackMarketInjection() {
  const surface = useStorySurface('black-market.room');
  const entry = surface.entries.find(
    (candidate): candidate is StorySurfaceBlackMarketEntry =>
      candidate.kind === 'black-market-encounter',
  );
  return {
    entry,
    interact: surface.interact,
    reload: surface.reload,
  };
}
