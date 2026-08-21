import { useStorySurface } from '@app/lib/hooks/useStorySurface';
import type { StorySurfaceAuctionListingEntry } from '@shared/types/story';

export function useStoryAuctionInjection() {
  const surface = useStorySurface('auction.list');
  const entry = surface.entries.find(
    (candidate): candidate is StorySurfaceAuctionListingEntry =>
      candidate.kind === 'auction-listing',
  );
  return {
    entry,
    interact: surface.interact,
    reload: surface.reload,
  };
}
