import {
  GameLoadingState,
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneNote,
  GameSceneSection,
} from '@app/components/game-shell';
import {
  InkBadge,
  InkButton,
  InkCard,
  InkDetailDrawer,
  InkNotice,
} from '@app/components/ui';
import type {
  StoryArchiveEntry,
  StoryArchiveResponse,
} from '@shared/lib/story/personalStory';
import { useEffect, useState } from 'react';

const STORY_STEPS = [
  '来信',
  '抉择',
  '途中追查',
  '关联秘境',
  '延迟回响',
] as const;

const LIFE_STATUS_LABELS: Record<
  StoryArchiveEntry['entities'][number]['lifeStatus'],
  string
> = {
  active: '在世',
  dead: '已死亡',
  missing: '失踪',
  sealed: '封禁中',
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  unknown: '未证实',
  neutral: '中立',
  trusting: '信任',
  wary: '戒备',
  hostile: '敌对',
};

function formatStoryDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StoryProgress({ entry }: { entry: StoryArchiveEntry }) {
  return (
    <ol
      className="grid grid-cols-5 gap-1"
      aria-label={`当前剧情进度：${entry.progress.label}`}
    >
      {STORY_STEPS.map((step, index) => {
        const stepIndex = index + 1;
        const reached = stepIndex <= entry.progress.stepIndex;
        const current = stepIndex === entry.progress.stepIndex;
        return (
          <li
            key={step}
            aria-current={current ? 'step' : undefined}
            className="min-w-0 text-center"
          >
            <div
              className={`mx-auto mb-1 h-1 w-full ${
                reached ? 'bg-crimson/65' : 'bg-ink/10'
              }`}
            />
            <span
              className={`text-[0.7rem] leading-5 ${
                current ? 'text-crimson font-semibold' : 'text-ink-secondary'
              }`}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StoryArchiveDetail({ entry }: { entry: StoryArchiveEntry }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2 text-sm leading-7">
        <p>{entry.premise}</p>
        {entry.selectedChoiceLabel ? (
          <p>
            <span className="text-ink-secondary">已确认选择：</span>
            {entry.selectedChoiceLabel}
          </p>
        ) : null}
      </div>

      <StoryProgress entry={entry} />

      {entry.beats.map((beat) => (
        <section
          key={`${entry.id}:${beat.type}`}
          className="border-ink/15 border-t border-dashed pt-4"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-ink font-semibold">{beat.title}</h3>
            <span className="text-ink-secondary text-xs">
              {formatStoryDate(beat.createdAt)}
            </span>
          </div>
          <p className="text-ink/80 text-sm leading-7 whitespace-pre-wrap">
            {beat.content}
          </p>
        </section>
      ))}

      {entry.entities.length > 0 ? (
        <section className="border-ink/15 border-t border-dashed pt-4">
          <h3 className="text-ink mb-3 font-semibold">关键人物</h3>
          <div className="space-y-3">
            {entry.entities.map((entity) => (
              <div key={entity.id} className="border-ink/15 border-l-2 pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{entity.name}</span>
                  <InkBadge>{LIFE_STATUS_LABELS[entity.lifeStatus]}</InkBadge>
                  <span className="text-ink-secondary text-xs">
                    {RELATIONSHIP_LABELS[entity.relationship] ??
                      entity.relationship}
                  </span>
                </div>
                <p className="text-ink-secondary mt-1 text-sm leading-6">
                  {entity.state}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {entry.nextHook ? (
        <GameSceneNote>
          <span className="text-ink-secondary">留存线索：</span>
          {entry.nextHook}
        </GameSceneNote>
      ) : null}
    </div>
  );
}

export default function StoryArchivePage() {
  const [archive, setArchive] = useState<StoryArchiveResponse | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<StoryArchiveEntry | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadArchive = async () => {
      try {
        const response = await fetch('/api/story/archive', {
          cache: 'no-store',
        });
        const result = (await response.json()) as {
          success?: boolean;
          data?: StoryArchiveResponse;
          error?: string;
        };
        if (!response.ok || !result.data) {
          throw new Error(result.error || '剧情档案读取失败');
        }
        if (!cancelled) setArchive(result.data);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : '剧情档案读取失败',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadArchive();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <GameSceneFrame variant="lite">
        <GameLoadingState message="正在整理前尘卷宗……" variant="inline" />
      </GameSceneFrame>
    );
  }

  const current = archive?.current ?? null;
  const history = archive?.history ?? [];

  return (
    <GameSceneFrame
      variant="workflow"
      aside={
        <>
          <GameSceneAsideSection title="卷宗摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>累计章节：{archive?.total ?? 0}</p>
              <p>进行中：{current ? 1 : 0}</p>
              <p>已归档：{history.length}</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection
            title="记录范围"
            help={{
              title: '主线纪事记录什么',
              content: (
                <div className="space-y-2 text-sm leading-7">
                  <p>只记录重要剧情信、关联云游、关联秘境结果和人物状态。</p>
                  <p>普通邮件和无关云游不会填入主线卷宗。</p>
                </div>
              ),
            }}
          />
        </>
      }
    >
      {error ? <InkNotice tone="danger">{error}</InkNotice> : null}

      <GameSceneSection title="当前主线">
        {current ? (
          <InkCard className="space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h2 className="text-ink font-semibold">{current.title}</h2>
                  <InkBadge>{current.progress.label}</InkBadge>
                </div>
                <p className="text-ink-secondary text-sm leading-7">
                  {current.premise}
                </p>
              </div>
              <InkButton
                variant="secondary"
                onClick={() => setSelectedEntry(current)}
              >
                展开卷宗
              </InkButton>
            </div>

            <StoryProgress entry={current} />
            <GameSceneNote>{current.progress.nextAction}</GameSceneNote>
          </InkCard>
        ) : (
          <InkNotice>
            目前没有进行中的主线。下一章会在相关经历留下回响时，以重要剧情信的方式出现。
          </InkNotice>
        )}
      </GameSceneSection>

      <GameSceneSection title="已归档章节">
        {history.length === 0 ? (
          <InkNotice>尚无已归档的主线章节。</InkNotice>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => (
              <InkCard key={entry.id} className="p-0">
                <button
                  type="button"
                  className="hover:bg-ink/4 w-full p-4 text-left transition-colors"
                  onClick={() => setSelectedEntry(entry)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="text-ink font-medium">
                          {entry.title}
                        </span>
                        <InkBadge>{entry.progress.label}</InkBadge>
                      </div>
                      <p className="text-ink-secondary line-clamp-2 text-sm leading-6">
                        {entry.premise}
                      </p>
                    </div>
                    <span className="text-ink-secondary shrink-0 text-xs">
                      {formatStoryDate(entry.resolvedAt ?? entry.createdAt)}
                    </span>
                  </div>
                </button>
              </InkCard>
            ))}
          </div>
        )}
      </GameSceneSection>

      <InkDetailDrawer
        isOpen={selectedEntry !== null}
        onClose={() => setSelectedEntry(null)}
        title={selectedEntry?.title ?? '主线卷宗'}
        description={
          selectedEntry
            ? `${selectedEntry.progress.label} · ${formatStoryDate(
                selectedEntry.createdAt,
              )}`
            : undefined
        }
        size="lg"
      >
        {selectedEntry ? <StoryArchiveDetail entry={selectedEntry} /> : null}
      </InkDetailDrawer>
    </GameSceneFrame>
  );
}
