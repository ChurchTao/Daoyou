import { PerformancePlayer } from '@app/components/feature/performance/PerformancePlayer';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton } from '@app/components/ui';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { useStory } from '@app/lib/story/useStory';
import { fillPerformanceScript } from '@shared/performance/schema';
import { getPerformanceScript } from '@shared/performance/catalog';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

export default function StoryRoute() {
  const navigate = useNavigate();
  const story = useStory();
  const profile = useCultivatorIdentity();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const cultivator = profile.data?.cultivator;
  const scriptId = story.story?.scriptId;

  if (story.loading || profile.loading) {
    return <GameLoadingState variant="fullscreen" message="玉简还在显字……" />;
  }

  if (story.error || profile.error || !cultivator) {
    return (
      <div className="app-safe-area-page flex min-h-[100svh] items-center justify-center bg-paper px-6 text-ink">
        <div className="max-w-md text-center">
          <p>玉简暂时读不清。</p>
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

  const script = fillPerformanceScript(getPerformanceScript(scriptId), {
    name: cultivator.name,
    background: cultivator.background?.trim() || '尚无来处',
  });

  return (
    <PerformancePlayer
      key={script.id}
      script={script}
      context={{
        name: cultivator.name,
        background: cultivator.background?.trim() || '尚无来处',
      }}
      finalLabel="进入洞府"
      exitLabel="稍后再看"
      busy={busy}
      error={error}
      onExit={() => navigate('/game')}
      onFinish={(outcome) => {
        setBusy(true);
        setError(undefined);
        void consumeResourceMutation(
          fetch(`/api/story/performances/${encodeURIComponent(scriptId)}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outcome }),
          }),
        )
          .then(() => navigate('/game', { replace: true }))
          .catch((reason: unknown) => {
            setError(reason instanceof Error ? reason.message : '这页没能记住，再试一次。');
            setBusy(false);
          });
      }}
    />
  );
}
