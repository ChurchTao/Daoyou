import { InkButton } from '@app/components/ui/InkButton';
import { apiFetch } from '@app/lib/api/fetch';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type { CompleteStoryPassage } from '@daoyou/contracts/story';
import { getMapPassage } from '@daoyou/game-content/world/map';
import type { StoryView } from '@daoyou/game-domain/story';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export function StoryLocationAction({
  story,
  atDestination = false,
}: {
  story: StoryView;
  atDestination?: boolean;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const passage = story.passage && getMapPassage(story.passage.id);
  if (story.playHref || (story.passage?.hint && !atDestination)) {
    return (
      <InkButton
        href={story.playHref ?? story.href}
        variant="primary"
        className="min-h-11"
      >
        {story.actionLabel ?? (story.kind === 'battle' ? '迎战' : '继续剧情')}
      </InkButton>
    );
  }
  if (!passage) return null;

  const depart = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const input: CompleteStoryPassage = {
        chapterId: story.chapterId,
        beatId: story.beatId,
        passageId: passage.id,
      };
      const next = await consumeResourceMutation<StoryView>(
        await apiFetch('/api/story/passages/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }),
      );
      void navigate(next.href, { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : '这段行程未能记下，请重试。',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <InkButton
        pending={busy}
        variant="primary"
        className="min-h-11"
        onClick={() => void depart()}
      >
        {passage.label}
      </InkButton>
      {error ? (
        <p role="alert" className="text-crimson mt-1 text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
