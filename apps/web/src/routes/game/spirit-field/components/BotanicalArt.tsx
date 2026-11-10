import { GameImage } from '@app/components/ui/GameImage';
import { cn } from '@app/lib/cn';
import type {
  SpiritGardenPlantView,
  SpiritGardenSpeciesId,
} from '@daoyou/game-domain/spirit-field';
import { getSpiritGardenSpecies } from '@daoyou/game-rules/spirit-field';

export interface BotanicalArtProps {
  speciesId: SpiritGardenSpeciesId;
  stage?: SpiritGardenPlantView['stage'];
  className?: string;
  muted?: boolean;
}

/** Botanical specimen art uses the species' configured atlas and the shared artwork setting. */
export function BotanicalArt({
  speciesId,
  stage = 'mature',
  className,
  muted = false,
}: BotanicalArtProps) {
  const { portrait } = getSpiritGardenSpecies(speciesId);
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
      <span className="botanical-art__print">
        <GameImage
          src={`/assets/spirit-garden/${portrait.atlas}.webp`}
          alt=""
          loading="lazy"
          draggable={false}
          className="absolute max-w-none"
          style={{
            width: '400%',
            height: '200%',
            left: `${-(portrait.index % 4) * 100}%`,
            top: `${-Math.floor(portrait.index / 4) * 100}%`,
          }}
        />
      </span>
    </span>
  );
}
