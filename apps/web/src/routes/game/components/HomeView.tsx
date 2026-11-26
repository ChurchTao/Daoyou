import { YieldCard } from '@app/components/feature/cultivator/YieldCard';
import { useCultivatorDisplayProjection } from '@app/components/feature/cultivator/useCultivatorDisplayProjection';
import { HomeAct, HomeLabel } from '@app/components/feature/home/HomeAct';
import { HomeCaller } from '@app/components/feature/home/HomeCaller';
import { HomeDays } from '@app/components/feature/home/HomeDays';
import { HomeDivination } from '@app/components/feature/home/HomeDivination';
import {
  HomeDoors,
  type HomeDoor,
} from '@app/components/feature/home/HomeDoors';
import { HomeRoad, type HomeStop } from '@app/components/feature/home/HomeRoad';
import { HomeRumors } from '@app/components/feature/home/HomeRumors';
import { getSectIdentityLabels } from '@app/components/feature/sect/sectIdentityDisplay';
import { GameSceneLoading } from '@app/components/game-shell/GameSceneFrame';
import { InkButton, InkNotice } from '@app/components/ui';
import { GameImage } from '@app/components/ui/GameImage';
import { useTaskList } from '@app/lib/hooks/useTaskList';
import {
  useCultivatorProgress,
  usePlayerSession,
  useSectMembership,
} from '@app/lib/resources/player';
import { storyPerformanceContext } from '@app/lib/story/performanceContext';
import { useStory } from '@app/lib/story/useStory';
import {
  findCurrentMajorBreakthroughTask,
  getBreakthroughNextStep,
} from '@app/lib/tasks/taskClient';
import { storyGateOpen, storySceneOpen } from '@daoyou/game-domain/story/gates';
import { getNextMajorRealm } from '@daoyou/game-rules/consumables/breakthrough';
import { useMemo } from 'react';

const WATCHES = '子丑寅卯辰巳午未申酉戌亥';

export function HomeView() {
  const projection = useCultivatorDisplayProjection();
  const progress = useCultivatorProgress();
  const sect = useSectMembership();
  const session = usePlayerSession();
  const cultivator = useMemo(
    () =>
      projection.data && progress.data
        ? {
            ...projection.data.cultivator,
            cultivation_progress: progress.data,
          }
        : null,
    [progress.data, projection.data],
  );
  const display = projection.data?.display ?? null;
  const isLoading = projection.loading || progress.loading;
  const {
    tasks,
    loading: tasksLoading,
    error: taskError,
    reload: reloadTasks,
  } = useTaskList(cultivator?.id);
  const body = useMemo(() => {
    if (!cultivator) return null;

    const hp = display?.resources.hp;
    const mp = display?.resources.mp;
    const maxHp = Math.max(1, Math.floor(hp?.max ?? 1));
    const maxMp = Math.max(1, Math.floor(mp?.max ?? 1));
    const cultivationProgress = cultivator.cultivation_progress;

    return {
      hpLow: Math.floor(hp?.current ?? maxHp) < maxHp,
      mpLow: Math.floor(mp?.current ?? maxMp) < maxMp,
      cultivationPercent: cultivationProgress
        ? Math.min(
            100,
            Math.floor(
              (cultivationProgress.cultivation_exp /
                cultivationProgress.exp_cap) *
                100,
            ),
          )
        : 0,
    };
  }, [cultivator, display]);

  const currentMajorTask = useMemo(
    () => (tasks ? findCurrentMajorBreakthroughTask(cultivator, tasks) : null),
    [cultivator, tasks],
  );
  const story = useStory(Boolean(cultivator));
  const storyCue = story.story?.prompt ? story.story : null;

  if (isLoading || story.loading || (!taskError && (tasksLoading || !tasks))) {
    return <GameSceneLoading message="正在进入洞府……" />;
  }

  if (!cultivator || !body) {
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

  const unlocked = story.story?.unlocked ?? null;
  const fresh = story.story?.fresh ?? [];
  const opened = (id: string) => storySceneOpen(unlocked, id);
  const percent = body.cultivationPercent;
  const hurt = body.hpLow || body.mpLow;
  const isMajorBreakthroughCandidate = Boolean(
    cultivator.realm_stage === '圆满' && getNextMajorRealm(cultivator.realm),
  );
  const unallocated = cultivator.unallocated_attribute_points ?? 0;
  const showYield = storyGateOpen(unlocked, 'yield');
  const showAttributes = unallocated > 0 && opened('cultivator-attributes');
  const showBreakthrough = currentMajorTask && opened('retreat');
  const retryBreakthrough =
    taskError && isMajorBreakthroughCandidate && opened('retreat');

  const doors: HomeDoor[] = [
    {
      id: 'retreat',
      label: '修炼室',
      href: '/game/retreat',
      note:
        percent >= 100 ? (
          isMajorBreakthroughCandidate ? (
            '可破境'
          ) : (
            '已满'
          )
        ) : (
          <span className="font-mono font-semibold tracking-tight">
            {percent}%
          </span>
        ),
      hot: percent >= 100,
    },
    {
      id: 'inn',
      label: '灵眼之泉',
      href: '/game/inn',
      note: hurt ? '带伤' : '无伤',
      hot: hurt,
      guide: 'cave.spring',
    },
    { id: 'alchemy', label: '炼丹房', href: '/game/craft/alchemy' },
    { id: 'refine', label: '炼器室', href: '/game/craft/refine' },
    { id: 'training-room', label: '练功房', href: '/game/training-room' },
    { id: 'beast-room', label: '育兽室', href: '/game/beast-room' },
    {
      id: 'storage',
      label: '储藏室',
      href: '/game/cave/storage/new?location=storage',
    },
    { id: 'spirit-field', label: '灵田', href: '/game/spirit-field' },
    { id: 'enlightenment', label: '悟道室', href: '/game/enlightenment' },
    { id: 'inscriptions', label: '阵纹室', href: '/game/inscriptions' },
  ];

  const sectLabels =
    sect.data?.status === 'active' ? getSectIdentityLabels(sect.data) : null;
  const stops: HomeStop[] = [
    {
      at: '门口',
      places: [
        {
          id: 'sect',
          label: '宗门',
          href: '/game/sect',
          note: sectLabels
            ? `${sectLabels.sectName} · ${sectLabels.rankLabel}`
            : '还没有师门',
        },
      ],
    },
    {
      at: '山脚',
      places: [
        { id: 'market', label: '坊市', href: '/game/map-v2?intent=market' },
        { id: 'auction', label: '拍卖行', href: '/game/auction' },
      ],
    },
    {
      at: '远处',
      places: [
        { id: 'map', label: '山河舆图', href: '/game/map-v2' },
        { id: 'dungeon', label: '云游', href: '/game/dungeon' },
        { id: 'tower', label: '蜃楼幻境', href: '/game/tower' },
        { id: 'hunt-team', label: '结伴讨伐', href: '/game/hunt-team' },
      ],
    },
  ];
  const anyRoad = stops.some((stop) =>
    stop.places.some((place) => opened(place.id)),
  );

  const watch = WATCHES[Math.floor(((new Date().getHours() + 1) % 24) / 2)];
  const showJournal = opened('journal');
  const showDivination = opened('divination');
  const showRumors = opened('map');

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-3 md:px-6 md:py-4">
      <article className="animate-fade-in bg-paper shadow-paper-panel grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]">
        <figure className="relative isolate h-44 overflow-hidden sm:h-56 lg:col-start-1 lg:row-start-1 lg:aspect-[3/2] lg:h-auto dark:bg-[radial-gradient(ellipse_at_50%_0%,#334542,transparent_72%)]">
          <GameImage
            src="/assets/mystery/scenes/cave.webp"
            alt=""
            className="absolute inset-0 size-full object-cover object-[center_72%] mix-blend-multiply dark:mix-blend-screen dark:[filter:grayscale(1)_invert(1)_brightness(0.48)]"
          />
          <figcaption className="from-paper absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t to-transparent px-5 pt-10 pb-2 md:px-7">
            <h1 className="font-heading text-ink text-3xl leading-tight">
              洞府
            </h1>
            <span className="text-ink-secondary text-xs tracking-[0.28em]">
              {watch}时
            </span>
          </figcaption>
        </figure>

        <div className="flex min-w-0 flex-col gap-7 px-5 pt-4 pb-7 md:px-7 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-7">
          {(storyCue ||
            showYield ||
            showAttributes ||
            showBreakthrough ||
            retryBreakthrough ||
            showDivination) && (
            <section>
              <HomeLabel>当下要事</HomeLabel>
              {storyCue && (
                <HomeCaller
                  story={storyCue}
                  context={storyPerformanceContext(
                    cultivator,
                    session.data?.activeCultivator?.sectId,
                  )}
                  sectId={session.data?.activeCultivator?.sectId}
                />
              )}
              {showYield && (
                <YieldCard
                  key={cultivator.id}
                  cultivator={cultivator}
                  trigger={({ hours, retry, claiming, claim }) => (
                    <HomeAct
                      lead={
                        claiming
                          ? '领取中…'
                          : retry
                            ? '重试领取历练收益'
                            : hours > 0
                              ? '领取历练收益'
                              : '历练收益'
                      }
                      note={
                        claiming || retry ? null : hours > 0 ? (
                          <>
                            <b className="font-mono">{hours}</b> 小时
                            {hours === 24 && ' · 已满'}
                          </>
                        ) : (
                          '满 1 小时可领'
                        )
                      }
                      onClick={claim}
                      busy={claiming}
                      disabled={hours < 1 && !retry}
                    />
                  )}
                />
              )}
              {showDivination && <HomeDivination key={cultivator.id} />}
              {showAttributes && (
                <HomeAct
                  href="/game/cultivator"
                  lead="分配属性"
                  note={
                    <>
                      <b className="font-mono">{unallocated}</b> 点可分配
                    </>
                  }
                />
              )}
              {showBreakthrough ? (
                <HomeAct
                  href="/game/retreat"
                  lead={
                    currentMajorTask.status === 'completed'
                      ? '开始突破'
                      : '查看突破条件'
                  }
                  note={getBreakthroughNextStep(currentMajorTask)}
                />
              ) : (
                retryBreakthrough && (
                  <HomeAct
                    lead="重试加载突破条件"
                    onClick={() => void reloadTasks()}
                  />
                )
              )}
            </section>
          )}

          <section>
            <HomeLabel>洞中</HomeLabel>
            <HomeDoors doors={doors} unlocked={unlocked} fresh={fresh} />
          </section>

          {anyRoad ? (
            <section>
              <HomeLabel>山下</HomeLabel>
              <HomeRoad stops={stops} unlocked={unlocked} fresh={fresh} />
            </section>
          ) : null}
        </div>

        {(showJournal || showRumors) && (
          <div className="border-ink/10 min-w-0 space-y-6 border-t px-5 pt-5 pb-7 md:px-7 lg:col-start-1 lg:row-start-2 lg:border-t-0 lg:pt-2">
            {showJournal && (
              <HomeDays key={cultivator.id} cultivatorId={cultivator.id!} />
            )}
            {showRumors && (
              <HomeRumors
                realm={cultivator.realm}
                showHunts={opened('hunt-team')}
                showAlchemy={opened('alchemy')}
              />
            )}
          </div>
        )}
      </article>
    </div>
  );
}
