import { YieldCard } from '@app/components/feature/cultivator/YieldCard';
import { CaveQuickGrid } from '@app/components/feature/home/CaveQuickGrid';
import { HomeAside } from '@app/components/feature/home/HomeAside';
import { HomeUrgentRow } from '@app/components/feature/home/HomeUrgentRow';
import { GameSceneFrame, GameSceneSection } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { usePlayerStateView } from '@app/lib/player-state/selectors';
import { useTaskList } from '@app/lib/hooks/useTaskList';
import { findCurrentMajorBreakthroughTask } from '@app/lib/tasks/taskClient';
import { getNextNoviceHomeAction } from '@app/lib/tasks/noviceHomeAction';
import { getNextMajorRealm } from '@shared/lib/breakthroughPill';
import {
  getPillToxicityStage,
  isConditionStatusActive,
} from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { getBodyCultivationSummary } from '@shared/lib/bodyCultivation/summary';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

function calculateYieldHours(lastYieldAt: Date | string | undefined) {
  if (!lastYieldAt) return 0;

  const timestamp = new Date(lastYieldAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;

  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60)));
}

export function HomeView() {
  const { cultivator, isLoading, display } = usePlayerStateView();
  const {
    tasks,
    loading: tasksLoading,
    error: taskError,
  } = useTaskList(cultivator?.id);
  const [yieldHours, setYieldHours] = useState(() =>
    calculateYieldHours(cultivator?.last_yield_at),
  );
  const [yieldInteractionActive, setYieldInteractionActive] = useState(false);

  useEffect(() => {
    const update = () =>
      setYieldHours(calculateYieldHours(cultivator?.last_yield_at));
    update();

    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [cultivator?.last_yield_at]);

  const caveStatus = useMemo(() => {
    if (!cultivator) return null;

    const hp = display?.resources.hp;
    const mp = display?.resources.mp;
    const maxHp = Math.max(1, Math.floor(hp?.max ?? 1));
    const maxMp = Math.max(1, Math.floor(mp?.max ?? 1));
    const currentHp = Math.max(0, Math.floor(hp?.current ?? maxHp));
    const currentMp = Math.max(0, Math.floor(mp?.current ?? maxMp));
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

    const bodySummary = getBodyCultivationSummary(cultivator.condition);
    const strongestBodyTrack = [...bodySummary.tracks].sort(
      (a, b) => b.level - a.level,
    )[0];
    const bodySummaryText =
      bodySummary.totalLevel > 0 && strongestBodyTrack
        ? [
            `肉身·${bodySummary.realm.label} 总 Lv.${bodySummary.totalLevel}`,
            `${strongestBodyTrack.layerName} Lv.${strongestBodyTrack.level}`,
            strongestBodyTrack.currentEffects[0],
          ].join(' · ')
        : null;

    return {
      activeStatuses,
      currentHp,
      currentMp,
      maxHp,
      maxMp,
      pillToxicityStage,
      cultivationPercent,
      bodySummaryText,
      insight: cultivationProgress?.comprehension_insight ?? 0,
    };
  }, [cultivator, display]);

  const currentMajorTask = useMemo(
    () => findCurrentMajorBreakthroughTask(cultivator, tasks),
    [cultivator, tasks],
  );

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
  const unallocatedAttributePoints =
    cultivator.unallocated_attribute_points ?? 0;
  const noviceAction = getNextNoviceHomeAction({
    tasks,
    cultivator,
    hp: display?.resources.hp,
    mp: display?.resources.mp,
  });
  const hasYieldAlert = yieldHours >= 1;
  const hasResourceAlert =
    caveStatus !== null &&
    (caveStatus.currentHp < caveStatus.maxHp ||
      caveStatus.currentMp < caveStatus.maxMp ||
      caveStatus.pillToxicityStage.key !== 'none' ||
      caveStatus.activeStatuses.length > 0);
  const hasBreakthroughAlert = (caveStatus?.cultivationPercent ?? 0) >= 60;
  const isMajorBreakthroughCandidate = Boolean(
    cultivator.realm_stage === '圆满' && getNextMajorRealm(cultivator.realm),
  );
  if (noviceAction) {
    urgentItems.push(
      <HomeUrgentRow
        key="novice-action"
        title={<span className="text-wood">{noviceAction.title}</span>}
        summary={noviceAction.summary}
        action={
          <InkButton href={noviceAction.href} variant="primary">
            {noviceAction.label}
          </InkButton>
        }
      />,
    );
  }

  if (unallocatedAttributePoints > 0) {
    urgentItems.push(
      <HomeUrgentRow
        key="unallocated-attributes"
        title={<span className="text-wood">✦ 根基待定</span>}
        summary={`尚有 ${unallocatedAttributePoints} 点可分配属性点`}
        action={
          <InkButton href="/game/cultivator/attributes" variant="primary">
            分配
          </InkButton>
        }
      />,
    );
  }

  if (hasYieldAlert || yieldInteractionActive) {
    urgentItems.push(
      <YieldCard
        key="yield"
        cultivator={cultivator}
        variant="compact"
        onInteractionActiveChange={setYieldInteractionActive}
      />,
    );
  }

  if (currentMajorTask) {
    const summary =
      currentMajorTask.status === 'completed'
        ? '准备充分，可冲关'
        : '需准备充分，方可冲关'
    urgentItems.push(
      <HomeUrgentRow
        key="major-breakthrough-task"
        title={<span className="text-crimson">⚡ 突破境界</span>}
        summary={summary}
        action={
          <InkButton
            href={
              currentMajorTask.status === 'completed'
                ? '/game/retreat'
                : '/game/tasks'
            }
            variant="primary"
          >
            {currentMajorTask.status === 'completed' ? '冲关' : '准备'}
          </InkButton>
        }
      />,
    );
  }

  if (
    hasBreakthroughAlert &&
    !currentMajorTask &&
    (!isMajorBreakthroughCandidate || taskError || !tasksLoading)
  ) {
    urgentItems.push(
      <HomeUrgentRow
        key="breakthrough"
        title={<span className="text-crimson">⚡ 突破瓶颈</span>}
        summary={`修为进度已达 ${Math.min(100, caveStatus?.cultivationPercent ?? 0)}%`}
        action={
          <InkButton href="/game/retreat" variant="primary">
            突破
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
      caveStatus?.pillToxicityStage.key !== 'none'
        ? caveStatus.pillToxicityStage.label
        : null,
      statusNames
        ? `${statusNames}${(caveStatus?.activeStatuses.length ?? 0) > 2 ? '等状态' : ''}`
        : null,
      caveStatus?.bodySummaryText,
    ].filter(Boolean);

    urgentItems.push(
      <HomeUrgentRow
        key="resource"
        title={<span className="text-crimson">☯ 道体状态</span>}
        summary={parts.join(' · ')}
        action={
          <InkButton href="/game/cultivator" variant="primary">
            查看
          </InkButton>
        }
      />,
    );
  }

  return (
    <GameSceneFrame title="洞府" aside={<HomeAside />}>
      <GameSceneSection title="当下要事">
        <div>
          {urgentItems.length > 0 ? (
            urgentItems.slice(0, 4)
          ) : (
            <HomeUrgentRow
              title={<span className="text-teal">◎ 今日安稳</span>}
              summary="暂无急报，可按心意静修或参悟"
              action={
                <InkButton
                  href="/game/retreat"
                  variant="primary"
                  className="px-0"
                >
                  修炼
                </InkButton>
              }
            />
          )}
        </div>
      </GameSceneSection>

      <GameSceneSection title="洞府各处">
        <CaveQuickGrid />
      </GameSceneSection>
    </GameSceneFrame>
  );
}
