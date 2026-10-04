import { useQiState } from '@app/components/feature/cultivator/useQiState';
import { MeritStamp } from '@app/components/feature/merit/MeritStamp';
import { getSectIdentityLabels } from '@app/components/feature/sect/sectIdentityDisplay';
import { useActiveSectContextQuery } from '@app/components/feature/sect/sectContext';
import { useSectIdentityDialog } from '@app/components/feature/sect/useSectIdentityDialog';
import Link from '@app/components/router/AppLink';
import { InkHorizontalScroll } from '@app/components/ui';
import { GameImage } from '@app/components/ui/GameImage';
import { getGameConceptInfo } from '@daoyou/game-content/presentation/concepts';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { GameTopHudPlaceholder, HudMeter, HudTag } from './GameHudIndicators';
import { useCombatActivityNotice } from './useCombatActivityNotice';
import { useGameHudDialogs } from './useGameHudDialogs';
import type { GameHudSnapshot } from './useGameHudModel';
import { usePlayerMeritTier } from './usePlayerMeritTier';

function formatSpiritStones(value: number): string {
  if (value >= 50000) {
    return `${Math.floor(value / 10000)}万`;
  }
  return String(value);
}

type HudStatusItem = {
  key: string;
  label?: string;
  value: ReactNode;
  tone?: 'default' | 'qi' | 'wealth';
  onClick?: () => void;
};

export function GameTopHud({ snapshot }: { snapshot: GameHudSnapshot | null }) {
  const navigate = useNavigate();
  const openSectIdentityDialog = useSectIdentityDialog();
  const sectContext = useActiveSectContextQuery();
  const {
    state: qiState,
    loading: qiLoading,
    error: qiError,
  } = useQiState({
    cultivatorId: snapshot?.cultivatorId ?? '',
  });
  const meritTier = usePlayerMeritTier(snapshot?.cultivatorId);
  const combatNotice = useCombatActivityNotice(!!snapshot?.cultivatorId);
  const dialogs = useGameHudDialogs(snapshot, qiState, qiError);

  if (!snapshot || !dialogs) return <GameTopHudPlaceholder />;

  const sectIdentity =
    sectContext.data && !sectContext.error
      ? getSectIdentityLabels(sectContext.data)
      : null;

  const qiDisplay = qiState
    ? `${qiState.current}/${qiState.max}`
    : qiLoading
      ? '汇聚中'
      : '--';
  const {
    openRealmInfo,
    openBodyCultivationInfo,
    openCultivationInfo,
    openInsightInfo,
    openQiInfo,
    openStatusInfo,
  } = dialogs;
  const qiInfo = getGameConceptInfo('world_qi');
  const spiritStonesInfo = getGameConceptInfo('spirit_stones');
  const reputationInfo = getGameConceptInfo('reputation');

  const hudStatusItems: HudStatusItem[] = [
    {
      key: 'realm',
      value: `${snapshot.realm}·${snapshot.realmStage}`,
      onClick: openRealmInfo,
    },
    {
      key: 'qi',
      label: `${qiInfo.icon} ${qiInfo.label}`,
      value: qiDisplay,
      tone: 'qi',
      onClick: openQiInfo,
    },
    {
      key: 'spirit-stones',
      label: `${spiritStonesInfo.icon} ${spiritStonesInfo.label}`,
      value: formatSpiritStones(snapshot.spiritStones),
      tone: 'wealth',
    },
    {
      key: 'reputation',
      label: `${reputationInfo.icon} ${reputationInfo.label}`,
      value: formatSpiritStones(snapshot.reputation),
      tone: 'wealth',
      onClick: () => {
        void navigate('/game/tianjiao-vault');
      },
    },
    ...(sectIdentity
      ? [
          {
            key: 'sect',
            label: '宗门',
            value: sectIdentity.sectName,
            onClick: openSectIdentityDialog,
          },
        ]
      : []),
    {
      key: 'status',
      label: '状态',
      value: snapshot.statusText,
      onClick: openStatusInfo,
    },
    {
      key: 'body-cultivation',
      value: snapshot.bodyCultivation.realm.label,
      onClick: openBodyCultivationInfo,
    },
  ];

  return (
    <header className="border-ink/10 sticky top-0 z-30 border-b border-dashed backdrop-blur-sm">
      <div className="mx-auto block w-full max-w-5xl pt-[calc(env(safe-area-inset-top)+0.5rem)] pr-[max(env(safe-area-inset-right),0.625rem)] pb-2 pl-[max(env(safe-area-inset-left),0.625rem)] text-left sm:pr-[max(env(safe-area-inset-right),0.75rem)] sm:pl-[max(env(safe-area-inset-left),0.75rem)] md:pr-[max(env(safe-area-inset-right),1.5rem)] md:pl-[max(env(safe-area-inset-left),1.5rem)]">
        {combatNotice ? (
          <Link
            href={combatNotice.href}
            className="border-crimson/35 bg-crimson/5 text-crimson hover:border-crimson/60 mx-auto mb-2 flex w-fit max-w-full items-center justify-center gap-2 border border-dashed px-3 py-1 text-center text-xs leading-5 transition-colors md:text-sm"
          >
            <span className="min-w-0 truncate">{combatNotice.title}</span>
            <span className="shrink-0">{combatNotice.action}</span>
          </Link>
        ) : null}
        <div className="grid min-w-0 grid-cols-[auto_minmax(3.75rem,0.55fr)_minmax(0,1fr)] items-center gap-2 md:grid-cols-[auto_minmax(8rem,0.44fr)_minmax(0,1fr)] md:gap-4">
          <Link
            href="/game/cultivator"
            aria-label="查看角色"
            className="border-ink/12 bg-bgpaper/85 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed md:h-16 md:w-16"
          >
            <GameImage
              purpose="interface"
              src="/assets/daoyou_logo.webp"
              alt=""
              className="-mt-0.5 h-9 w-9 object-contain md:h-12 md:w-12"
            />
          </Link>

          <div className="min-w-0">
            <div className="flex min-w-0 items-end gap-1.5 md:gap-2.5">
              <Link
                href="/game/cultivator"
                className="font-heading hover:text-crimson min-w-0 truncate text-xl leading-none transition-colors md:text-3xl"
              >
                {snapshot.name}
              </Link>
              {meritTier ? (
                <MeritStamp
                  tier={meritTier}
                  className="size-5 shrink-0 opacity-90 md:size-6"
                />
              ) : null}
              {snapshot.title ? (
                <div className="text-crimson hidden min-w-0 text-xs md:inline-block md:text-sm">
                  <span className="block truncate">「{snapshot.title}」</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-x-2 gap-y-1.5 md:grid-cols-2 md:gap-x-4 md:gap-y-2">
            {snapshot.metrics.map(({ key, ...metric }) => {
              const onClick =
                key === 'cultivation'
                  ? openCultivationInfo
                  : key === 'insight'
                    ? openInsightInfo
                    : undefined;

              return <HudMeter key={key} {...metric} onClick={onClick} />;
            })}
          </div>
        </div>

        <div className="mt-3 hidden min-w-0 flex-wrap items-center gap-1.5 md:flex">
          {hudStatusItems.map((item) => (
            <HudTag
              key={item.key}
              label={item.label}
              value={item.value}
              tone={item.tone}
              onClick={item.onClick}
            />
          ))}
        </div>

        <div className="mt-3 md:hidden">
          <InkHorizontalScroll
            ariaLabel="角色状态，可横向滑动查看更多"
            viewportClassName="pr-7"
            contentClassName="items-center gap-1.5"
            showStartHint={false}
          >
            {hudStatusItems.map((item) => (
              <HudTag
                key={item.key}
                className="max-w-[13rem] shrink-0 whitespace-nowrap"
                label={item.label}
                value={item.value}
                tone={item.tone}
                onClick={item.onClick}
              />
            ))}
          </InkHorizontalScroll>
        </div>
      </div>
    </header>
  );
}
