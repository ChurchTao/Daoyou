import { GameIcon, type GameIconProps } from '@app/components/ui/GameIcon';
import { BEAST_SPECIES } from '@shared/engine/combat-v6/beasts/content';

const speciesIcons = new Map(
  BEAST_SPECIES.map((s) => [s.id as string, s.icon]),
);

export function BeastIcon({
  speciesId,
  ...props
}: Omit<GameIconProps, 'value'> & { speciesId: string }) {
  return <GameIcon value={speciesIcons.get(speciesId) ?? '🐾'} {...props} />;
}
