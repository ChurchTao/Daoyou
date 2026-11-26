import { InkButton } from '@app/components/ui';
import { GameIcon } from '@app/components/ui/GameIcon';
import { SpiritStones } from '@app/components/ui/SpiritStones';
import { cn } from '@app/lib/cn';
import type {
  BattleRankingItem,
  WealthRankingEntry,
} from '@daoyou/contracts/rankings';
import { formatFullGameNumber } from '@daoyou/game-rules/presentation/numbers';
import { memo } from 'react';

interface BattleRankingCardProps {
  item: BattleRankingItem;
  isSelf: boolean;
  canChallenge: boolean;
  challengeUnavailableReason?: string;
  isChallenging: boolean;
  isProbing: boolean;
  onChallenge: (targetId: string) => Promise<void>;
  onProbe: (targetId: string) => Promise<void>;
  variant?: 'list' | 'podium';
}

interface WealthRankingCardProps {
  item: WealthRankingEntry;
  isSelf?: boolean;
  variant?: 'list' | 'podium';
}

function resolveBattleRankTone(rank: number) {
  if (rank === 1) {
    return {
      label: '榜首',
      className: 'border-gold/55 text-wood',
    };
  }
  if (rank <= 3) {
    return {
      label: `#${rank}`,
      className: 'border-crimson/35 text-crimson',
    };
  }
  return {
    label: `#${rank}`,
    className: 'border-ink/18 text-ink-secondary',
  };
}

function RankSeal({ label, className }: { label: string; className: string }) {
  return (
    <div
      className={cn(
        'inline-flex h-7 min-w-11 shrink-0 items-center justify-center border-0 px-1.5 text-center text-sm leading-none font-semibold lg:h-12 lg:min-w-[4.5rem] lg:border lg:border-dashed lg:px-2 lg:text-base',
        className,
      )}
    >
      {label}
    </div>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-ink/10 text-ink-secondary inline-flex min-h-6 items-center border border-dashed px-2 text-xs leading-5">
      {children}
    </span>
  );
}

function BattleRankingCardComponent({
  item,
  isSelf,
  canChallenge,
  challengeUnavailableReason,
  isChallenging,
  isProbing,
  onChallenge,
  onProbe,
}: BattleRankingCardProps) {
  const rankTone = resolveBattleRankTone(item.rank);
  const sectAffiliation = item.sectAffiliation || '散修';
  const realmLabel = [item.realm, item.realm_stage].filter(Boolean).join(' · ');
  const hasActions = !isSelf || Boolean(challengeUnavailableReason);

  return (
    <article
      className={cn(
        'group border-ink/25 hover:border-crimson/30 dark:bg-ink/4 relative min-w-0 overflow-hidden border border-dashed bg-white/30 transition-colors',
        isSelf && 'border-crimson/30 bg-amber-200/30',
      )}
    >
      <div
        className={cn(
          'grid min-w-0 gap-2 px-3 py-3 lg:grid-cols-[4.75rem_minmax(0,1fr)_7rem] lg:items-start lg:gap-4 lg:px-4 lg:py-3',
          !hasActions && 'lg:grid-cols-[4.75rem_minmax(0,1fr)]',
        )}
      >
        <div className="absolute top-3 right-3 flex items-start lg:static">
          <RankSeal label={rankTone.label} className={rankTone.className} />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-ink text-[1.05rem] leading-6 font-semibold wrap-break-word sm:text-lg sm:leading-7">
              {item.name}
            </h3>
            {item.title ? (
              <span className="text-ink-secondary text-sm leading-6 wrap-break-word">
                「{item.title}」
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
            {realmLabel ? (
              <MetaChip>
                <span className="text-crimson font-semibold">{realmLabel}</span>
              </MetaChip>
            ) : null}
            <MetaChip>{item.age} 岁</MetaChip>
            <MetaChip>{sectAffiliation}</MetaChip>
          </div>
        </div>

        {hasActions ? (
          <div className="mt-2 flex min-w-0 items-center justify-end gap-2 lg:mt-0">
            {challengeUnavailableReason ? (
              <span className="text-battle-muted mr-auto text-xs leading-5 lg:mr-0 lg:text-right">
                {challengeUnavailableReason}
              </span>
            ) : null}
            {!isSelf ? (
              <>
                <InkButton
                  onClick={() => onProbe(item.id)}
                  variant="secondary"
                  pending={isProbing}
                  pendingLabel="查探中……"
                  className="text-sm"
                >
                  查探
                </InkButton>
                {canChallenge ? (
                  <InkButton
                    onClick={() => onChallenge(item.id)}
                    variant="primary"
                    pending={isChallenging}
                    pendingLabel="挑战中……"
                    className="text-sm"
                  >
                    挑战
                  </InkButton>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function WealthRankingCardComponent({
  item,
  isSelf,
  variant = 'list',
}: WealthRankingCardProps) {
  const rankTone = resolveBattleRankTone(item.rank);
  const origin = item.origin ?? '散修';
  const realmLabel = [item.realm, item.realm_stage].filter(Boolean).join(' · ');
  const fullSpiritStones = `💰 ${formatFullGameNumber(item.spiritStones)}`;

  return (
    <article
      className={cn(
        'group border-ink/25 hover:border-crimson/30 dark:bg-ink/4 relative min-w-0 overflow-hidden border border-dashed bg-white/30 transition-colors',
        isSelf && 'border-crimson/30 bg-amber-200/30',
        variant === 'podium' && 'border-gold/30 bg-gold/15 dark:bg-gold/10',
      )}
    >
      <div className="grid min-w-0 gap-2 px-3 py-3 lg:grid-cols-[4.75rem_minmax(0,1fr)_8.5rem] lg:items-start lg:gap-4 lg:px-4 lg:py-3">
        <div className="absolute top-3 right-3 flex items-start lg:static">
          <RankSeal label={rankTone.label} className={rankTone.className} />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-ink text-[1.05rem] leading-6 font-semibold wrap-break-word sm:text-lg sm:leading-7">
              {item.name}
            </h3>
            {item.title ? (
              <span className="text-ink-secondary text-sm leading-6 wrap-break-word">
                「{item.title}」
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
            {realmLabel ? (
              <MetaChip>
                <span className="text-crimson font-semibold">{realmLabel}</span>
              </MetaChip>
            ) : null}
            <MetaChip>{item.age} 岁</MetaChip>
            <MetaChip>{origin}</MetaChip>
          </div>
        </div>

        <div className="mt-2 text-right lg:mt-0" title={fullSpiritStones}>
          <div className="text-battle-muted text-xs leading-5">
            <GameIcon value="💰" label="灵石" />
          </div>
          <div className="text-lg leading-7 font-semibold">
            <SpiritStones amount={item.spiritStones} mode="compact" />
          </div>
        </div>
      </div>
    </article>
  );
}

export const BattleRankingCard = memo(BattleRankingCardComponent);
export const WealthRankingCard = memo(WealthRankingCardComponent);
