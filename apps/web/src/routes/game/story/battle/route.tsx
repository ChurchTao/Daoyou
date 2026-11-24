import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { combatV6Request } from '@app/components/feature/combat-v6/request';
import { useCombatV6Session } from '@app/components/feature/combat-v6/useCombatV6Session';
import { InkButton } from '@app/components/ui';
import { useStory } from '@app/lib/story/useStory';
import type { StoryBattleSessionView } from '@daoyou/contracts/combat/story-battle';
import { storyArrivalHref } from '@daoyou/game-rules/story';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

const BASE = '/api/combat-v6/story-battle';

/**
 * 剧情战：主线指定的一场交手。
 * 进来就开打，打完回到主线接着往下。战斗界面是全游戏共用的那一套。
 */
export default function StoryBattlePage() {
  const { story, loading: storyLoading, reload: reloadStory } = useStory();
  const combat = useCombatV6Session<StoryBattleSessionView>(BASE);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { session, run, acceptSession } = combat;
  const atBattleEntry =
    !story?.playHref ||
    (params.get('chapter') === story.chapterId &&
      params.get('beat') === story.beatId);
  const wanted = atBattleEntry ? (story?.battleId ?? null) : null;
  // 这次进页面亲手打过的一场。只凭它判断要不要留在结算画面上。
  const [fought, setFought] = useState<string | null>(null);
  const settled = session?.settlement === 'settled';
  const live =
    session && !settled && session.battleId === wanted
      ? session.sessionId
      : null;
  if (live && fought !== live) setFought(live);
  // 主线资源可能先于战报更新，留住本页已经接手的战局直到结算播完。
  const mine =
    session && (live || fought === session.sessionId) ? session : null;

  const start = () =>
    run(async () => {
      const next = await combatV6Request<StoryBattleSessionView>(
        `${BASE}/sessions`,
        { method: 'POST' },
      );
      setFought(next.sessionId);
      acceptSession(next);
    });

  const ready = !combat.loading && !storyLoading;
  const starting = useRef(false);
  useEffect(() => {
    if (!ready || !wanted || mine || starting.current) return;
    starting.current = true;
    void start().finally(() => {
      starting.current = false;
    });
    // 只在主线等着一场、手上又没有战局时开打一次。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, wanted, mine]);

  useEffect(() => {
    if (settled) void reloadStory();
  }, [settled, reloadStory]);

  if (ready && !wanted && !mine)
    return (
      <Navigate
        to={story?.location ? storyArrivalHref(story) : '/game'}
        replace
      />
    );

  const leave = () => {
    if (!story || story.kind === 'battle') return;
    void navigate(
      story.kind === 'life' && !story.location
        ? '/game'
        : storyArrivalHref(story),
      {
        replace: true,
        viewTransition: !story.location,
      },
    );
  };
  const title = mine?.title ?? '交手';

  return (
    <CombatV6Page
      title={title}
      active={!!mine}
      loading={!mine && !combat.error}
      error={combat.error}
      onRetry={() => void combat.refresh(true)}
      back={story?.location ? story.href : '/game'}
      backLabel={story?.location ? '回主线地点' : '回洞府'}
    >
      {mine ? (
        <CombatV6Battle
          allowAbandon={false}
          title={title}
          session={mine}
          shown={combat.shown}
          log={combat.log}
          playing={combat.playing}
          pending={combat.pending}
          onCommand={combat.submit}
          onResolve={combat.resolve}
          onAuto={combat.submitAuto}
          onClose={() => {
            if (settled && !combat.playing && !mine.retry) leave();
          }}
          onBack={mine.retry ? undefined : leave}
          endAction={
            settled && mine.retry ? (
              <InkButton pending={combat.pending} onClick={() => void start()}>
                再来一次
              </InkButton>
            ) : mine.settlement === 'pending' ? (
              <InkButton
                pending={combat.pending}
                onClick={() => void combat.resolve()}
              >
                重试结算
              </InkButton>
            ) : undefined
          }
          back="/game"
          backLabel={mine.retry ? '回洞府' : '接着往下'}
        />
      ) : null}
    </CombatV6Page>
  );
}
