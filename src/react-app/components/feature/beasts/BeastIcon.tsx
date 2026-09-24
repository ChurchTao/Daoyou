import type { GameIconProps } from '@app/components/ui/GameIcon';
import { BEAST_SPECIES } from '@shared/engine/combat-v6/beasts/content';
import { BeastPortrait } from './BeastPortrait';

const speciesIcons = new Map(
  BEAST_SPECIES.map((s) => [s.id as string, s.icon]),
);

export function BeastIcon({
  speciesId,
  ...props
}: Omit<GameIconProps, 'value'> & { speciesId: string; isMutant?: boolean }) {
  return (
    <BeastPortrait value={speciesIcons.get(speciesId) ?? '🐾'} {...props} />
  );
}
