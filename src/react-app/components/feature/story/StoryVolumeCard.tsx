import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useMainStory } from '@app/lib/hooks/useMainStory';

export function StoryVolumeCard() {
  const { story, loading, error } = useMainStory();

  if (loading && !story) {
    return (
      <InkCard variant="plain" padding="none">
        <p className="text-ink-secondary text-sm leading-7">主线卷宗正在归档……</p>
      </InkCard>
    );
  }

  if (error && !story) return <InkNotice>{error}</InkNotice>;
  if (!story) return null;

  if (story.status === 'locked') {
    return (
      <InkCard variant="plain" padding="none">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-heading text-base">{story.volumeTitle}</h3>
            <span className="text-ink-secondary text-sm">未启卷</span>
          </div>
          <p className="text-ink-secondary text-sm leading-7">
            {story.lockReason ?? story.summary}
          </p>
        </div>
      </InkCard>
    );
  }

  return (
    <InkCard variant={story.status === 'completed' ? 'default' : 'highlighted'}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="font-heading text-base">{story.volumeTitle}</h3>
          <span className="text-ink-secondary text-sm">
            {story.progressText}{story.status === 'completed' ? ' · 已完卷' : ''}
          </span>
        </div>

        <div>
          <p className="text-sm font-medium">{story.currentTitle}</p>
          <p className="text-ink-secondary mt-1 text-sm leading-7">{story.summary}</p>
        </div>

        {story.knownFacts.length > 0 ? (
          <div className="border-ink/15 border-t border-dashed pt-3">
            <p className="text-xs tracking-[0.16em] text-ink-secondary">你已经确认</p>
            <ul className="mt-2 space-y-1.5 text-sm leading-6">
              {story.knownFacts.slice(-5).map((fact) => (
                <li key={fact}>· {fact}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {story.status === 'completed' ? (
          story.nextVolumeTitle ? (
            <p className="text-ink-secondary text-sm leading-7">
              下一卷：{story.nextVolumeTitle}
            </p>
          ) : null
        ) : story.action ? (
          <div className="border-ink/15 border-t border-dashed pt-3">
            <p className="text-ink-secondary mb-2 text-sm leading-6">
              主线会在相应场景中自动发生；这里的按钮只用于中断后的回到线索。
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <InkButton href={story.action.href} variant="primary">
                回到当前线索
              </InkButton>
              <span className="text-ink-secondary text-sm">{story.action.label}</span>
            </div>
          </div>
        ) : (
          <p className="text-ink-secondary text-sm leading-7">
            当前卷页正在等待真实玩法结算，完成后会自动续接剧情。
          </p>
        )}
      </div>
    </InkCard>
  );
}
