import { cn } from '@app/lib/cn';
import {
  SPIRIT_GARDEN_SPECIES_IDS,
  type SpiritGardenPlantView,
  type SpiritGardenSpeciesId,
} from '@daoyou/game-domain/spirit-field';

export interface BotanicalArtProps {
  speciesId: SpiritGardenSpeciesId;
  stage?: SpiritGardenPlantView['stage'];
  className?: string;
  muted?: boolean;
}

/** Botanical illustration atlas, separate from the shared item-icon protocol. */
export function BotanicalArt({
  speciesId,
  stage = 'mature',
  className,
  muted = false,
}: BotanicalArtProps) {
  const index = SPIRIT_GARDEN_SPECIES_IDS.indexOf(speciesId);
  return (
    <span
      aria-hidden="true"
      className={cn(
        'botanical-art',
        `botanical-art--${stage}`,
        muted && 'botanical-art--muted',
        className,
      )}
    >
      <span
        className="botanical-art__print"
        style={{
          backgroundPosition: `${(index % 4) * (100 / 3)}% ${Math.floor(index / 4) * 100}%`,
        }}
      />
    </span>
  );
}
