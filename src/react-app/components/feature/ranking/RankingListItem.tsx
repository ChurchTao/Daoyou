import {
  PillKeywordLine,
  toPillDisplayModel,
} from '@app/components/feature/consumables';
import { InkBadge, InkButton, type Tier } from '@app/components/ui';
import { cn } from '@shared/lib/cn';
import { isPillSpec } from '@shared/lib/consumables';
import {
  formatCompactGameNumber,
  formatFullGameNumber,
} from '@shared/lib/numberFormat';
import {
  CONSUMABLE_TYPE_DISPLAY_MAP,
  getEquipmentSlotInfo,
} from '@shared/lib/gameConceptDisplay';
import type { RealmType } from '@shared/types/constants';
import type { PillSpec } from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';
import type {
  BattleRankingItem,
  ItemRankingEntry,
  RankingsDisplayItem,
  WealthRankingEntry,
} from '@shared/types/rankings';
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

interface ItemRankingCardProps {
  item: ItemRankingEntry;
  viewerRealm?: RealmType;
  onViewDetails?: (item: ItemRankingEntry) => void;
  variant?: 'list' | 'podium';
}

interface WealthRankingCardProps {
  item: WealthRankingEntry;
  isSelf?: boolean;
  variant?: 'list' | 'podium';
}

interface LegacyRankingListItemProps {
  item: RankingsDisplayItem;
  isSelf: boolean;
  canChallenge: boolean;
  isChallenging: boolean;
  isProbing: boolean;
  onChallenge: (targetId: string) => Promise<void>;
  onProbe: (targetId: string) => Promise<void>;
  customSubtitle?: string;
  customMeta?: string;
  isItem?: boolean;
  viewerRealm?: RealmType;
  onViewDetails?: (item: ItemRankingEntry) => void;
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

function resolveItemRankTone(rank: number) {
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

function resolveItemIcon(item: ItemRankingEntry) {
  if (item.itemType === 'artifact') {
    return getEquipmentSlotInfo(
      (item.slot as 'weapon' | 'armor' | 'accessory') || 'weapon',
    ).icon;
  }

  if (item.itemType === 'elixir') {
    return CONSUMABLE_TYPE_DISPLAY_MAP[(item.type as '丹药' | '符箓') || '丹药']
      .icon;
  }

  return item.itemType === 'technique' ? '典' : '诀';
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
  const origin = item.origin ?? '散修';
  const realmLabel = [item.realm, item.realm_stage].filter(Boolean).join(' · ');
  const hasActions = !isSelf || Boolean(challengeUnavailableReason);

  return (
    <article
      className={cn(
        'group border-ink/25 hover:border-crimson/30 relative min-w-0 overflow-hidden border border-dashed bg-white/30 transition-colors',
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
            <MetaChip>{origin}</MetaChip>
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
                  disabled={isProbing}
                  className="text-sm"
                >
                  {isProbing ? '查探中' : '查探'}
                </InkButton>
                {canChallenge ? (
                  <InkButton
                    onClick={() => onChallenge(item.id)}
                    variant="primary"
                    disabled={isChallenging}
                    className="text-sm"
                  >
                    {isChallenging ? '挑战中' : '挑战'}
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

function ItemRankingCardComponent({
  item,
  viewerRealm,
  onViewDetails,
  variant = 'list',
}: ItemRankingCardProps) {
  const pillDisplay =
    item.itemType === 'elixir' && isPillSpec(item.spec as PillSpec | undefined)
      ? toPillDisplayModel(
          {
            id: item.id,
            name: item.name,
            type: (item.type as Consumable['type']) || '丹药',
            quality: item.quality as Consumable['quality'],
            quantity: item.quantity || 1,
            description: item.description,
            spec: item.spec as PillSpec,
          },
          { realm: viewerRealm },
        )
      : null;
  const icon = resolveItemIcon(item);
  const rankTone = resolveItemRankTone(item.rank);

  return (
    <article
      className={cn(
        'group border-ink/25 hover:border-crimson/30 relative min-w-0 overflow-hidden border border-dashed bg-white/30 transition-colors',
        variant === 'podium' && 'border-gold/30 bg-gold/15',
      )}
    >
      <div className="grid min-w-0 gap-2 px-3 py-3 lg:grid-cols-[4.75rem_minmax(0,1fr)_6.25rem] lg:items-start lg:gap-4 lg:px-4 lg:py-3">
        <div className="absolute top-3 right-3 flex items-start lg:static">
          <RankSeal label={rankTone.label} className={rankTone.className} />
        </div>

        <div className="min-w-0">
          <div className="grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-2">
            <span className="text-ink inline-flex h-7 w-7 items-center justify-center text-sm">
              {icon}
            </span>
            <h3 className="text-ink min-w-0 text-[1.05rem] leading-6 font-semibold wrap-break-word sm:text-lg sm:leading-7">
              {item.name}
            </h3>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <MetaChip>
              <span className="text-wood font-semibold">评分 {item.score}</span>
            </MetaChip>
            <MetaChip>持有者：{item.ownerName}</MetaChip>
            {item.quality ? (
              <InkBadge tier={item.quality as Tier}>
                {item.type || '品质'}
              </InkBadge>
            ) : null}
            {item.element ? (
              <InkBadge tone="default">{item.element}</InkBadge>
            ) : null}
          </div>

          <div className="mt-2 min-w-0 space-y-1">
            <p className="text-ink-secondary line-clamp-2 text-xs leading-5">
              {pillDisplay?.primaryEffect || item.description || '暂无描述'}
            </p>
            {pillDisplay ? (
              <PillKeywordLine labels={pillDisplay.keywordLabels} />
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex justify-end lg:mt-0 lg:items-start lg:justify-end">
          <InkButton
            variant="secondary"
            onClick={() => onViewDetails?.(item)}
            className="text-sm"
          >
            瞻仰一二
          </InkButton>
        </div>
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
  const fullSpiritStones = `${formatFullGameNumber(item.spiritStones)} 灵石`;

  return (
    <article
      className={cn(
        'group border-ink/25 hover:border-crimson/30 relative min-w-0 overflow-hidden border border-dashed bg-white/30 transition-colors',
        isSelf && 'border-crimson/30 bg-amber-200/30',
        variant === 'podium' && 'border-gold/30 bg-gold/15',
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
          <div className="text-battle-muted text-xs leading-5">灵石</div>
          <div className="text-wood text-lg leading-7 font-semibold">
            {formatCompactGameNumber(item.spiritStones)}
          </div>
          <div className="text-battle-muted text-xs leading-5">
            {fullSpiritStones}
          </div>
        </div>
      </div>
    </article>
  );
}

export const BattleRankingCard = memo(BattleRankingCardComponent);
export const ItemRankingCard = memo(ItemRankingCardComponent);
export const WealthRankingCard = memo(WealthRankingCardComponent);

function RankingListItemComponent({
  item,
  isSelf,
  canChallenge,
  isChallenging,
  isProbing,
  onChallenge,
  onProbe,
  isItem = false,
  viewerRealm,
  onViewDetails,
}: LegacyRankingListItemProps) {
  if (isItem) {
    return (
      <ItemRankingCard
        item={item as ItemRankingEntry}
        viewerRealm={viewerRealm}
        onViewDetails={onViewDetails}
      />
    );
  }

  if ('rankingType' in item && item.rankingType === 'wealth') {
    return <WealthRankingCard item={item as WealthRankingEntry} isSelf={isSelf} />;
  }

  return (
    <BattleRankingCard
      item={item as BattleRankingItem}
      isSelf={isSelf}
      canChallenge={canChallenge}
      isChallenging={isChallenging}
      isProbing={isProbing}
      onChallenge={onChallenge}
      onProbe={onProbe}
    />
  );
}

export const RankingListItem = memo(RankingListItemComponent);
