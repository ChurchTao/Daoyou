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

const stageRows = { seedling: 0, mature: 1, nurtured: 2, evolved: 3 } as const;

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
            height: '400%',
            left: `${-portrait.index * 100}%`,
            top: `${-stageRows[stage] * 100}%`,
          }}
        />
      </span>
    </span>
  );
}
