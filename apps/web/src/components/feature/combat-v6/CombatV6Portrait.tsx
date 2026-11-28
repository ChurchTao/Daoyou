import { BeastPortrait } from '@app/components/feature/beasts/BeastPortrait';
import { AvatarArtwork } from '@app/components/feature/cultivator/CultivatorAvatar';
import type { CombatV6UnitAppearance } from '@daoyou/game-domain/combat';
import { combatPortraitValue } from './presentation';
import type { CombatV6Unit } from './session';

export function CombatV6Portrait({
  unit,
  appearance,
}: {
  unit: Pick<CombatV6Unit, 'name' | 'ownerId' | 'kind'>;
  appearance?: CombatV6UnitAppearance;
}) {
  const fallback = (
    <BeastPortrait
      isMutant={appearance?.isMutant}
      value={combatPortraitValue(unit, appearance)}
    />
  );
  if (!appearance?.avatarId) return fallback;

  return (
    <span aria-hidden="true" className="inline-flex size-[1em] shrink-0">
      <AvatarArtwork
        id={appearance.avatarId}
        size="96"
        alt=""
        className="size-full"
        fallback={fallback}
      />
    </span>
  );
}
