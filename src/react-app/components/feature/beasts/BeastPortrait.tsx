import { GameIcon, type GameIconProps } from '@app/components/ui/GameIcon';
import { cn } from '@shared/lib/cn';

/** Shared by owned beasts and frozen battle/replay appearances. */
export function BeastPortrait({
  isMutant,
  className,
  ...props
}: GameIconProps & { isMutant?: boolean }) {
  return (
    <GameIcon
      {...props}
      className={cn(
        className,
        isMutant && '[filter:sepia(0.65)_saturate(2)_hue-rotate(235deg)]',
      )}
    />
  );
}
