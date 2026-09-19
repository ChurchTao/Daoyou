import { getLevelRealmStage } from '@shared/config/realmProgression';
import type { BeastTradePreview } from '@shared/contracts/beastTrade';
import { BEAST_SPECIES } from '@shared/engine/combat-v6/beasts/content';
import { BeastIcon } from './BeastIcon';
import { BeastMutationTag } from './BeastMutationTag';

/** The same compact identity is used for browsing, owned listings and selection. */
export function BeastTradeCard({
  beast,
  price,
  disabled,
  onClick,
}: {
  beast: BeastTradePreview;
  price?: number;
  disabled?: boolean;
  onClick: () => void;
}) {
  const species = BEAST_SPECIES.find((entry) => entry.id === beast.speciesId);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`查看${beast.isMutant ? '变异' : ''}${species?.name ?? '灵兽'}，${beast.level}级，${beast.skills.length}技能${species ? `，携带境界${getLevelRealmStage(species.carryLevel).label}` : ''}${price === undefined ? '' : `，${price.toLocaleString()}灵石`}`}
      onClick={onClick}
      className="bg-paper border-ink/20 hover:border-crimson/50 focus-visible:outline-crimson flex w-full min-w-0 items-center gap-4 border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
    >
      <BeastIcon
        speciesId={beast.speciesId}
        isMutant={beast.isMutant}
        className="shrink-0 text-6xl"
      />
      <span className="min-w-0 flex-1 space-y-1 text-sm">
        <span className="flex flex-wrap items-center gap-2 text-base font-semibold">
          {species?.name}
          <BeastMutationTag isMutant={beast.isMutant} />
        </span>
        <span className="text-ink-secondary block">
          <span className="font-mono">{beast.level}</span>级 ·{' '}
          <span className="font-mono">{beast.skills.length}</span>技能
        </span>
        {species && (
          <span className="text-ink-secondary block">
            携带境界 {getLevelRealmStage(species.carryLevel).label}
          </span>
        )}
        {price !== undefined && (
          <span className="block pt-1 text-amber-800">
            <span className="font-mono font-semibold">
              {price.toLocaleString()}
            </span>{' '}
            灵石
          </span>
        )}
      </span>
    </button>
  );
}
