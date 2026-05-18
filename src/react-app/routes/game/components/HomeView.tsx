import { useLifespanStatus } from '@app/components/feature/cultivator/LifespanStatusCard';
import { YieldCard } from '@app/components/feature/cultivator/YieldCard';
import { DivineFortune } from '@app/components/feature/home/DivineFortune';
import { RecentBattles } from '@app/components/feature/ranking/RecentBattles';
import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneInset,
  GameSceneSection,
} from '@app/components/game-shell';
import { InkButton, InkList, InkListItem, InkNotice } from '@app/components/ui';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import {
  getPillToxicityStage,
  isConditionStatusActive,
} from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { getAllTrackConfigs } from '@shared/lib/trackConfigRegistry';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

interface CaveAreaAction {
  label: string;
  href: string;
  variant?: 'primary' | 'secondary';
}

interface CaveArea {
  title: string;
  copy: string;
  actions: CaveAreaAction[];
}

const CAVE_AREAS: CaveArea[] = [
  {
    title: '静室',
    copy: '收束呼吸，押上寿元，闭关或择机冲关。',
    actions: [
      { label: '入静室', href: '/game/retreat', variant: 'primary' },
      { label: '观道身', href: '/game/cultivator' },
    ],
  },
  {
    title: '丹房',
    copy: '炉火未熄，丹气正稳，适合调息与解厄。',
    actions: [
      { label: '开炉炼丹', href: '/game/craft/alchemy', variant: 'primary' },
      { label: '点灵材', href: '/game/inventory' },
    ],
  },
  {
    title: '器室',
    copy: '法器陈列于架，锤火与佩装都在此处分流。',
    actions: [
      { label: '炼器整备', href: '/game/craft/refine', variant: 'primary' },
      { label: '看法宝', href: '/game/artifacts' },
    ],
  },
  {
    title: '书案',
    copy: '经卷摊开，最宜参悟功法、推演神通、重塑命格。',
    actions: [
      { label: '入藏经阁', href: '/game/enlightenment', variant: 'primary' },
      { label: '重塑命格', href: '/game/fate-reshape' },
    ],
  },
  {
    title: '山门',
    copy: '出门即是天地，往坊市流转，或踏云游历练。',
    actions: [
      {
        label: '前往坊市',
        href: '/game/map?intent=market',
        variant: 'primary',
      },
      { label: '外出历练', href: '/game/map' },
    ],
  },
  {
    title: '玉简案',
    copy: '来函、世界传音与外界讯息都从此案落卷。',
    actions: [
      { label: '查玉简', href: '/game/mail', variant: 'primary' },
      { label: '听传音', href: '/game/world-chat' },
    ],
  },
];

function calculateYieldHours(lastYieldAt: Date | string | undefined) {
  if (!lastYieldAt) return 0;

  const timestamp = new Date(lastYieldAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;

  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60)));
}

function CaveAside() {
  return (
    <>
      <GameSceneAsideSection title="近况卷 · 今日卜辞">
        <DivineFortune />
      </GameSceneAsideSection>

      <GameSceneAsideSection title="近况卷 · 近期战札">
        <RecentBattles />
      </GameSceneAsideSection>
    </>
  );
}

function CaveAreaCard({ area }: { area: CaveArea }) {
  return (
    <GameSceneInset className="px-4 py-4">
      <div className="text-ink text-base font-semibold tracking-[0.04em]">
        {area.title}
      </div>
      <p className="text-ink-secondary mt-2 text-sm leading-7">{area.copy}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {area.actions.map((action) => (
          <InkButton
            key={action.href}
            href={action.href}
            variant={action.variant === 'primary' ? 'primary' : 'secondary'}
          >
            {action.label}
          </InkButton>
        ))}
      </div>
    </GameSceneInset>
  );
}

export function HomeView() {
  const { cultivator, isLoading, note, finalAttributes } = useCultivator();
  const [yieldHours, setYieldHours] = useState(() =>
    calculateYieldHours(cultivator?.last_yield_at),
  );
  const { status: lifespanStatus } = useLifespanStatus({
    cultivatorId: cultivator?.id ?? '',
    autoRefresh: true,
    refreshInterval: 60_000,
  });

  useEffect(() => {
    const update = () =>
      setYieldHours(calculateYieldHours(cultivator?.last_yield_at));
    update();

    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [cultivator?.last_yield_at]);

  const caveStatus = useMemo(() => {
    if (!cultivator) return null;

    const maxHp = Math.max(1, Math.floor(finalAttributes?.maxHp ?? 1));
    const maxMp = Math.max(1, Math.floor(finalAttributes?.maxMp ?? 1));
    const currentHp = Math.max(
      0,
      Math.floor(cultivator.condition?.resources.hp.current ?? maxHp),
    );
    const currentMp = Math.max(
      0,
      Math.floor(cultivator.condition?.resources.mp.current ?? maxMp),
    );
    const activeStatuses = (cultivator.condition?.statuses ?? []).filter(
      (status) => isConditionStatusActive(status),
    );
    const pillToxicityStage = getPillToxicityStage(cultivator.condition);
    const cultivationProgress = cultivator.cultivation_progress;
    const cultivationPercent = cultivationProgress
      ? Math.floor(
          (cultivationProgress.cultivation_exp / cultivationProgress.exp_cap) *
            100,
        )
      : 0;

    const trackSummary = getAllTrackConfigs()
      .map((config) => {
        const state =
          config.key === 'marrow_wash'
            ? cultivator.condition?.tracks.marrowWash
            : cultivator.condition?.tracks.tempering[
                config.key.replace('tempering.', '') as keyof NonNullable<
                  typeof cultivator.condition
                >['tracks']['tempering']
              ];
        const level = state?.level ?? 0;
        const progress = state?.progress ?? 0;
        const threshold = config.thresholdByLevel(level);

        if (level <= 0 && progress <= 0) {
          return null;
        }

        return `${config.name.replace('炼体·', '')} Lv.${level} ${progress}/${threshold}`;
      })
      .filter((entry): entry is string => Boolean(entry))
      .slice(0, 3)
      .join(' · ');

    return {
      activeStatuses,
      currentHp,
      currentMp,
      maxHp,
      maxMp,
      pillToxicityStage,
      cultivationPercent,
      trackSummary,
      insight: cultivationProgress?.comprehension_insight ?? 0,
    };
  }, [cultivator, finalAttributes]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">正在推演天机……</p>
      </div>
    );
  }

  if (!cultivator) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <InkNotice>
          尚未觉醒灵根，无法入驻洞府。
          <InkButton href="/game/create" variant="primary" className="ml-2">
            前往觉醒
          </InkButton>
        </InkNotice>
      </div>
    );
  }

  const urgentItems: ReactNode[] = [];
  const hasYieldAlert = yieldHours >= 1;
  const hasResourceAlert =
    caveStatus !== null &&
    (caveStatus.currentHp < caveStatus.maxHp ||
      caveStatus.currentMp < caveStatus.maxMp ||
      caveStatus.pillToxicityStage.key !== 'none' ||
      caveStatus.activeStatuses.length > 0);
  const hasBreakthroughAlert = (caveStatus?.cultivationPercent ?? 0) >= 60;
  const lifespanRatio = lifespanStatus
    ? lifespanStatus.consumed / Math.max(lifespanStatus.dailyLimit, 1)
    : 0;
  const hasLifespanAlert = lifespanRatio >= 0.7;

  if (hasYieldAlert) {
    urgentItems.push(
      <YieldCard key="yield" cultivator={cultivator} variant="compact" />,
    );
  }

  if (hasBreakthroughAlert) {
    urgentItems.push(
      <InkListItem
        key="breakthrough"
        title="⚡ 冲关火候已到"
        meta={`修为约 ${caveStatus?.cultivationPercent ?? 0}% · 感悟 ${caveStatus?.insight ?? 0}/100`}
        description="静室中的突破时机已经成熟，宜尽快收束外务，再决定稳冲还是强破。"
        actions={
          <InkButton href="/game/retreat" variant="primary">
            入静室
          </InkButton>
        }
      />,
    );
  }

  if (hasResourceAlert) {
    const statusNames = caveStatus?.activeStatuses
      .slice(0, 2)
      .map(
        (status) => getConditionStatusTemplate(status.key)?.name ?? status.key,
      )
      .join('、');
    const parts = [
      caveStatus && caveStatus.currentHp < caveStatus.maxHp
        ? `气血 ${caveStatus.currentHp}/${caveStatus.maxHp}`
        : null,
      caveStatus && caveStatus.currentMp < caveStatus.maxMp
        ? `真元 ${caveStatus.currentMp}/${caveStatus.maxMp}`
        : null,
      caveStatus?.pillToxicityStage.key !== 'none'
        ? caveStatus?.pillToxicityStage.label
        : null,
      statusNames
        ? `${statusNames}${(caveStatus?.activeStatuses.length ?? 0) > 2 ? '等状态' : ''}`
        : null,
    ].filter(Boolean);

    urgentItems.push(
      <InkListItem
        key="resource"
        title="☯ 道体未稳"
        meta={parts.join(' · ')}
        description="先整理伤势与持续影响，再决定继续闭关、炼丹调息，或外出历练。"
        actions={
          <>
            <InkButton href="/game/cultivator">看道身</InkButton>
            <InkButton href="/game/craft/alchemy" variant="primary">
              去丹房
            </InkButton>
          </>
        }
      />,
    );
  }

  if (hasLifespanAlert) {
    urgentItems.push(
      <InkListItem
        key="lifespan"
        title="⏳ 今日寿元消耗偏高"
        meta={`已用 ${lifespanStatus?.consumed ?? 0}/${lifespanStatus?.dailyLimit ?? 0} 年`}
        description="若仍要闭关，先去静室核算本次要押上的年数，避免今日耗用过深。"
        actions={
          <InkButton href="/game/retreat" variant="primary">
            核算寿元
          </InkButton>
        }
      />,
    );
  }

  return (
    <GameSceneFrame title="洞府" aside={<CaveAside />}>
      <GameSceneSection title="洞府一瞥">
        <div className="space-y-2 text-sm leading-7">
          <p>
            石门半掩，纸窗透白。丹火、经卷、器架与玉简都安放在各自的位置，今日该做什么，一眼便可分明。
          </p>
          {note ? <p className="text-ink-secondary">{note}</p> : null}
          {caveStatus?.trackSummary ? (
            <p className="text-battle-muted">
              外炼余功：{caveStatus.trackSummary}
            </p>
          ) : null}
        </div>
      </GameSceneSection>

      <GameSceneSection title="当下要事">
        {urgentItems.length > 0 ? (
          <InkList>{urgentItems.slice(0, 4)}</InkList>
        ) : (
          <InkList>
            <InkListItem
              title="今日洞府安稳"
              meta="暂无迫切事务"
              description="状态平顺，收益未满，外炼也无急报。可按心意闭关、炼丹、参悟，或出门行走。"
              actions={
                <>
                  <InkButton href="/game/retreat" variant="primary">
                    入静室
                  </InkButton>
                  <InkButton href="/game/enlightenment">去书案</InkButton>
                </>
              }
            />
          </InkList>
        )}
      </GameSceneSection>

      <GameSceneSection title="洞府诸处">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CAVE_AREAS.map((area) => (
            <CaveAreaCard key={area.title} area={area} />
          ))}
        </div>
      </GameSceneSection>
    </GameSceneFrame>
  );
}
