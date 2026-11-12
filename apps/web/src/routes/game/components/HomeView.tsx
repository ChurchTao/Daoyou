import { YieldCard } from '@app/components/feature/cultivator/YieldCard';
import { useCultivatorDisplayProjection } from '@app/components/feature/cultivator/useCultivatorDisplayProjection';
import { HomeAct, HomeLabel } from '@app/components/feature/home/HomeAct';
import { HomeCaller } from '@app/components/feature/home/HomeCaller';
import { HomeDays } from '@app/components/feature/home/HomeDays';
import {
  HomeDoors,
  type HomeDoor,
} from '@app/components/feature/home/HomeDoors';
import { HomeRoad, type HomeStop } from '@app/components/feature/home/HomeRoad';
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
import { getNextMajorRealm } from '@daoyou/game-rules/consumables/breakthrough';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

function calculateYieldHours(lastYieldAt: Date | string | undefined) {
  if (!lastYieldAt) return 0;

  const timestamp = new Date(lastYieldAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;

  return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60)));
}

const WATCHES = '子丑寅卯辰巳午未申酉戌亥';

/** 眼下是什么时辰，洞口是什么光景。 */
function readSky(now: Date) {
  const hour = now.getHours();
  return {
    watch: `${WATCHES[Math.floor(((hour + 1) % 24) / 2)]}时`,
    line:
      hour >= 5 && hour < 8
        ? '天刚亮，洞口的石阶上还挂着露水。'
        : hour >= 8 && hour < 17
          ? '日头照进洞口，石阶晒得发白。'
          : hour >= 17 && hour < 20
            ? '天色暗下来了，洞口灌进来一点凉风。'
            : '夜深了，洞里只听得见泉水的声音。',
  };
}

/**
 * 洞府：玩家自己的住所，也是游戏的主页。
 * 它和剧情演出是同一本书：一幅画，一段眼前的光景，
 * 找上门的人，手边的东西，洞里的石门，下山的路，这几日的事。
 */
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

  if (isLoading || (!taskError && (tasksLoading || !tasks))) {
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
  const opened = (id: string) => !unlocked || unlocked.includes(id);
  const percent = body.cultivationPercent;
  const hurt = body.hpLow || body.mpLow;
  const isMajorBreakthroughCandidate = Boolean(
    cultivator.realm_stage === '圆满' && getNextMajorRealm(cultivator.realm),
  );
  const unallocated = cultivator.unallocated_attribute_points ?? 0;
  const pouch = (yieldHours >= 1 || yieldInteractionActive) && opened('yield');
  const scroll = Boolean(currentMajorTask) && opened('tasks');

  // 手边：屋里摆着的、伸手就能办的事。
  const athand: ReactNode[] = [];
  if (pouch) {
    athand.push(
      <YieldCard
        key="yield"
        cultivator={cultivator}
        onInteractionActiveChange={setYieldInteractionActive}
        trigger={({ hours, retry, claiming, claim }) => (
          <HomeAct
            lead={claiming ? '正在清点……' : retry ? '再解一次布袋' : '解开布袋'}
            onClick={claim}
            busy={claiming}
          >
            {claiming
              ? null
              : hours >= 24
                ? '，里头攒了整整一天的东西'
                : `，清点这 ${hours} 个时辰攒下的东西`}
          </HomeAct>
        )}
      />,
    );
  }
  if (unallocated > 0 && opened('cultivator-attributes')) {
    athand.push(
      <HomeAct
        key="attributes"
        href="/game/cultivator/attributes"
        lead="把根基落定"
        note={
          <>
            还有{' '}
            <span className="font-mono font-semibold tracking-tight">
              {unallocated}
            </span>{' '}
            点悬着
          </>
        }
      />,
    );
  }
  if (currentMajorTask && scroll) {
    const ready = currentMajorTask.status === 'completed';
    athand.push(
      <HomeAct
        key="breakthrough"
        href={ready ? '/game/retreat' : '/game/tasks'}
        lead={ready ? '去静室冲关' : '翻开破境的卷宗'}
        note={getBreakthroughNextStep(currentMajorTask)}
      />,
    );
  } else if (taskError && isMajorBreakthroughCandidate && opened('tasks')) {
    athand.push(
      <HomeAct
        key="breakthrough-reload"
        lead="再翻一次卷宗"
        note="破境的卷宗刚才没读到"
        onClick={() => void reloadTasks()}
      />,
    );
  }

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
        { id: 'hunt-team', label: '组队讨伐', href: '/game/hunt-team' },
      ],
    },
  ];
  const anyDoor = doors.some((door) => opened(door.id));
  const anyRoad = stops.some((stop) =>
    stop.places.some((place) => opened(place.id)),
  );

  // 眼前：先说身上和洞口的光景，再说案上摆着什么，最后说还有哪里没去过。
  const sky = readSky(new Date());
  const sights = [
    unlocked && !anyRoad
      ? '洞里很干净，石床上铺着新的干草。'
      : hurt && opened('inn')
        ? '身上还带着伤，里间的泉水冒着热气。'
        : percent >= 100 && opened('retreat')
          ? '丹田里的气涨得发紧，坐不住。'
          : sky.line,
    pouch && scroll
      ? '石案上压着一只鼓起来的布袋，旁边摊着半卷破境的卷宗。'
      : pouch
        ? '石案上压着一只鼓起来的布袋。'
        : scroll
          ? '石案上摊着半卷破境的卷宗。'
          : null,
    anyDoor ? null : '往里有几道石门，都还合着。',
    anyRoad ? null : '你还不认得下山的路。',
  ].filter(Boolean);

  const showJournal = opened('journal');
  const showDivination = opened('divination');

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-3 md:px-6 md:py-4">
      <article className="animate-fade-in bg-paper grid shadow-[inset_0_1px_0_rgba(255,255,255,0.32),0_10px_30px_rgba(44,24,16,0.06)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]">
        <figure className="relative h-44 overflow-hidden sm:h-56 lg:col-start-1 lg:row-start-1 lg:aspect-[3/2] lg:h-auto">
          <GameImage
            src="/assets/mystery/scenes/cave.webp"
            alt=""
            className="absolute inset-0 size-full object-cover object-[center_72%] mix-blend-multiply"
          />
          <figcaption className="from-paper absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t to-transparent px-5 pt-10 pb-2 md:px-7">
            <h1 className="font-heading text-ink text-3xl leading-tight">
              洞府
            </h1>
            <span className="text-ink-secondary text-xs tracking-[0.28em]">
              {sky.watch}
            </span>
          </figcaption>
        </figure>

        <div className="flex min-w-0 flex-col gap-7 px-5 pt-4 pb-7 md:px-7 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-7">
          <section>
            <HomeLabel>眼前</HomeLabel>
            <p className="text-ink/85 text-lg leading-9">{sights.join('')}</p>
          </section>

          {storyCue ? (
            <HomeCaller
              story={storyCue}
              context={storyPerformanceContext(
                cultivator,
                session.data?.activeCultivator?.sectId,
              )}
              sectId={session.data?.activeCultivator?.sectId}
            />
          ) : null}

          {athand.length > 0 ? (
            <section>
              <HomeLabel>手边</HomeLabel>
              {athand}
            </section>
          ) : null}

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

        {showJournal || showDivination ? (
          <section className="border-ink/10 min-w-0 border-t px-5 pt-5 pb-7 md:px-7 lg:col-start-1 lg:row-start-2 lg:border-t-0 lg:pt-2">
            <HomeLabel>这几日</HomeLabel>
            <HomeDays
              key={cultivator.id}
              cultivatorId={cultivator.id!}
              journal={showJournal}
              divination={showDivination}
            />
          </section>
        ) : null}
      </article>
    </div>
  );
}
