import { PerformancePlayer } from '@app/components/feature/performance/PerformancePlayer';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton } from '@app/components/ui';
import { apiFetch } from '@app/lib/api/fetch';
import { cn } from '@app/lib/cn';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import {
  useCultivatorIdentity,
  usePlayerSession,
} from '@app/lib/resources/player';
import {
  fillStoryScript,
  storyPerformanceContext,
} from '@app/lib/story/performanceContext';
import { useStory } from '@app/lib/story/useStory';
import { getPerformanceScript } from '@daoyou/game-content/performance/catalog';
import type { StoryView } from '@daoyou/game-domain/story';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';

const LEAVE_MS = 350;

export default function StoryRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const story = useStory();
  const profile = useCultivatorIdentity();
  const player = usePlayerSession();
  const [error, setError] = useState<string>();
  const [finishing, setFinishing] = useState<StoryView>();
  const [exitTo, setExitTo] = useState<{
    href: string;
    viewTransition: boolean;
  }>();
  const checkpoint = finishing ?? story.story;
  const cultivator = profile.data?.cultivator;
  const scriptId = checkpoint?.scriptId;

  useEffect(() => {
    if (!exitTo) return;
    const timer = window.setTimeout(() => {
      void navigate(exitTo.href, {
        replace: true,
        viewTransition: exitTo.viewTransition,
      });
    }, LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [exitTo, navigate]);

  if (story.loading || profile.loading || player.loading) {
    return <GameLoadingState variant="fullscreen" message="正在接续故事……" />;
  }

  if (story.error || profile.error || player.error || !cultivator) {
    return (
      <div className="app-safe-area-page bg-paper text-ink flex min-h-dvh items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p>故事暂时没能接上。</p>
          <InkButton onClick={() => navigate('/game')} className="mt-5">
            回洞府
          </InkButton>
        </div>
      </div>
    );
  }

  if (!scriptId || checkpoint?.kind !== 'performance') {
    return (
      <Navigate to={checkpoint?.location ? checkpoint.href : '/game'} replace />
    );
  }

  if (!finishing) {
    if (checkpoint.playHref) {
      if (location.pathname + location.search !== checkpoint.playHref)
        return <Navigate to={checkpoint.href} replace />;
    } else if (checkpoint.href !== '/game/story') {
      return <Navigate to={checkpoint.href} replace />;
    }
  }

  const context = storyPerformanceContext(
    cultivator,
    player.data?.activeCultivator?.sectId,
  );
  const script = fillStoryScript(
    getPerformanceScript(scriptId, player.data?.activeCultivator?.sectId),
    context,
    player.data?.activeCultivator?.sectId,
  );

  return (
    <div
      className={cn(
        'transition-opacity ease-out',
        exitTo ? 'opacity-0' : 'opacity-100',
      )}
      style={{ transitionDuration: `${LEAVE_MS}ms` }}
    >
      <PerformancePlayer
        key={script.id}
        script={script}
        context={context}
        playerPortrait={
          cultivator.gender === '女'
            ? 'icon:cultivator-female-avatar'
            : 'icon:cultivator-male-avatar'
        }
        finalLabel={
          checkpoint.finishLabel ??
          (script.id === 'mine-sparring-verdict' ? '留下看同门试手' : '继续')
        }
        exitLabel="稍后再看"
        busy={Boolean(finishing)}
        error={error}
        onExit={() =>
          void navigate(checkpoint.location ? checkpoint.href : '/game', {
            replace: true,
            viewTransition: !checkpoint.location,
          })
        }
        flags={checkpoint.flags}
        onFinish={(outcome, chosen) => {
          const exitHref = checkpoint.exitHref;
          // 资源更新可能先于转场。保存到当前幕退出为止。
          setFinishing(checkpoint);
          setError(undefined);
          void apiFetch(
            `/api/story/performances/${encodeURIComponent(scriptId)}/complete`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ outcome, chosen }),
            },
          )
            .then((response) => consumeResourceMutation<StoryView>(response))
            .then((next) => {
              // 接着还是演出就直接换幕；要回到游戏界面，先让纸页淡下去。
              if (!exitHref && next.kind === 'performance' && !next.location) {
                setFinishing(undefined);
                void navigate(next.href, { replace: true });
                return;
              }
              // 地点之间沿用当前的淡出，缩放和旋转时亦可直接恢复到目的地。
              setExitTo({
                href: exitHref ?? next.href,
                viewTransition: !checkpoint.location && !next.location,
              });
            })
            .catch((reason: unknown) => {
              setError(
                reason instanceof Error
                  ? reason.message
                  : '这页没能记住，再试一次。',
              );
              setFinishing(undefined);
            });
        }}
      />
    </div>
  );
}
