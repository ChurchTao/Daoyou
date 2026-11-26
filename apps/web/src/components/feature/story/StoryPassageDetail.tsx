import { InkButton } from '@app/components/ui/InkButton';
import { apiFetch } from '@app/lib/api/fetch';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type { CompleteStoryPassage } from '@daoyou/contracts/story';
import type { StoryView } from '@daoyou/game-domain/story';
import type { MapPassage } from '@daoyou/game-domain/world/map';
import { storyArrivalHref } from '@daoyou/game-rules/story';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export function StoryPassageDetail({
  story,
  passage,
}: {
  story: StoryView;
  passage: MapPassage;
}) {
  const hint = story.passage?.hint;
  return (
    <section className="space-y-4">
      <h3 className="text-base font-semibold">{passage.entrance.name}</h3>
      <p className="text-ink-secondary text-sm leading-7">
        {hint ?? passage.entrance.description}
      </p>
      {hint ? (
        <InkButton href={story.href} variant="primary" className="min-h-11">
          {story.actionLabel ?? '展开舆图'}
        </InkButton>
      ) : (
        <StoryPassageAction story={story} passage={passage} />
      )}
    </section>
  );
}

export function StoryPassageAction({
  story,
  passage,
}: {
  story: StoryView;
  passage: MapPassage;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

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
      void navigate(storyArrivalHref(next), { replace: true });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : '这段行程未能记下，请重试。',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
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
    </>
  );
}
