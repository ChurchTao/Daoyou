import { apiFetch } from '@app/lib/api/fetch';
import { PerformancePlayer } from '@app/components/feature/performance/PerformancePlayer';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton } from '@app/components/ui';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorIdentity, usePlayerSession } from '@app/lib/resources/player';
import { storyPerformanceContext } from '@app/lib/story/performanceContext';
import { useStory } from '@app/lib/story/useStory';
import { fillPerformanceScript } from '@daoyou/game-domain/performance';
import type { StoryView } from '@daoyou/game-domain/story';
import { getPerformanceScript } from '@daoyou/game-content/performance/catalog';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

export default function StoryRoute() {
  const navigate = useNavigate();
  const story = useStory();
  const profile = useCultivatorIdentity();
  const player = usePlayerSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const cultivator = profile.data?.cultivator;
  const scriptId = story.story?.scriptId;

  if (story.loading || profile.loading || player.loading) {
    return <GameLoadingState variant="fullscreen" message="正在接续故事……" />;
  }

  if (story.error || profile.error || player.error || !cultivator) {
    return (
      <div className="app-safe-area-page flex min-h-[100svh] items-center justify-center bg-paper px-6 text-ink">
        <div className="max-w-md text-center">
          <p>故事暂时没能接上。</p>
          <InkButton onClick={() => navigate('/game')} className="mt-5">
            回洞府
          </InkButton>
        </div>
      </div>
    );
  }

  if (!scriptId || story.story?.kind !== 'performance') {
    return <Navigate to="/game" replace />;
  }

  const context = storyPerformanceContext(
    cultivator,
    player.data?.activeCultivator?.sectId,
  );
  const script = fillPerformanceScript(getPerformanceScript(scriptId), context);

  return (
    <PerformancePlayer
      key={script.id}
      script={script}
      context={context}
      finalLabel="继续"
      exitLabel="稍后再看"
      busy={busy}
      error={error}
      onExit={() => navigate('/game')}
      onFinish={(outcome) => {
        setBusy(true);
        setError(undefined);
        void apiFetch(`/api/story/performances/${encodeURIComponent(scriptId)}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome }),
        })
          .then((response) => consumeResourceMutation<StoryView>(response))
          .then((next) => {
            setBusy(false);
            navigate(next.href, { replace: true });
          })
          .catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : '这页没能记住，再试一次。');
            setBusy(false);
          });
      }}
    />
  );
}
