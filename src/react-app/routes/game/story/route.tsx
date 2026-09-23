import { PerformancePlayer } from '@app/components/feature/performance/PerformancePlayer';
import { NarrativePerformanceLoading } from '@app/components/feature/narrative/NarrativePerformanceLoading';
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
    return <NarrativePerformanceLoading message="玉简还在显字……" />;
  }

  if (story.error || profile.error || !cultivator) {
    return (
      <div className="flex min-h-[100svh] items-center justify-center px-6 text-[#f3ecdc]">
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
            setError(reason instanceof Error ? reason.message : '演出没能记下');
            setBusy(false);
          });
      }}
    />
  );
}
