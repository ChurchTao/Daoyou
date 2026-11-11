import { apiFetch } from '@app/lib/api/fetch';
import { PerformancePlayer } from '@app/components/feature/performance/PerformancePlayer';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton } from '@app/components/ui';
import { cn } from '@app/lib/cn';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorIdentity, usePlayerSession } from '@app/lib/resources/player';
import { storyPerformanceContext } from '@app/lib/story/performanceContext';
import { useStory } from '@app/lib/story/useStory';
import { fillPerformanceScript } from '@daoyou/game-domain/performance';
import type { StoryView } from '@daoyou/game-domain/story';
import { getPerformanceScript } from '@daoyou/game-content/performance/catalog';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

const LEAVE_MS = 350;

export default function StoryRoute() {
  const navigate = useNavigate();
  const story = useStory();
  const profile = useCultivatorIdentity();
  const player = usePlayerSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // 淡出期间主线已经走到下一幕，纸上要留着刚演完的这一场。
  const [leaving, setLeaving] = useState<string | null>(null);
  const cultivator = profile.data?.cultivator;
  const scriptId = leaving ?? story.story?.scriptId;

  if (story.loading || profile.loading || player.loading) {
    return <GameLoadingState variant="fullscreen" message="正在接续故事……" />;
  }

  if (story.error || profile.error || player.error || !cultivator) {
    return (
      <div className="app-safe-area-page flex min-h-dvh items-center justify-center bg-paper px-6 text-ink">
        <div className="max-w-md text-center">
          <p>故事暂时没能接上。</p>
          <InkButton onClick={() => navigate('/game')} className="mt-5">
            回洞府
          </InkButton>
        </div>
      </div>
    );
  }

  if (!scriptId || (!leaving && story.story?.kind !== 'performance')) {
    return <Navigate to="/game" replace />;
  }

  const context = storyPerformanceContext(
    cultivator,
    player.data?.activeCultivator?.sectId,
  );
  const script = fillPerformanceScript(getPerformanceScript(scriptId), context);

  return (
    <div
      className={cn(
        'transition-opacity ease-out',
        leaving ? 'opacity-0' : 'opacity-100',
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
      finalLabel="继续"
      exitLabel="稍后再看"
      busy={busy}
      error={error}
      onExit={() => void navigate('/game', { viewTransition: true })}
      flags={story.story?.flags}
      onFinish={(outcome, chosen) => {
        setBusy(true);
        setError(undefined);
        void apiFetch(`/api/story/performances/${encodeURIComponent(scriptId)}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome, chosen }),
        })
          .then((response) => consumeResourceMutation<StoryView>(response))
          .then((next) => {
            // 接着还是演出就直接换幕；要回到游戏界面，先让纸页淡下去。
            if (next.kind === 'performance') {
              setBusy(false);
              void navigate(next.href, { replace: true });
              return;
            }
            setLeaving(scriptId);
            window.setTimeout(() => {
              void navigate(next.href, { replace: true, viewTransition: true });
            }, LEAVE_MS);
          })
          .catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : '这页没能记住，再试一次。');
            setBusy(false);
          });
      }}
    />
    </div>
  );
}
