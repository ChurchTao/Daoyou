import { InkButton, InkCard } from '@app/components/ui';
import { useMainStory } from '@app/lib/hooks/useMainStory';
import { notifyStoryRuntimeEvent } from '@app/lib/story/storyClient';
import { useEffect, useRef, useState } from 'react';
import { StoryCinematicStage } from './StoryCinematicStage';
import { isStoryStep } from './storyNativeHelpers';

const voiceActs = [
  {
    id: 'quiet',
    eyebrow: '筑基之后',
    title: '太安静了',
    body: '突破的灵光、疼痛和喧响都退下去。\n\n世界忽然安静得过分。',
  },
  {
    id: 'water',
    eyebrow: '不知来处',
    title: '先是水声',
    body: '很远。\n\n像潮水隔着一片你从未去过的岸。',
  },
  {
    id: 'voice',
    eyebrow: '？？？',
    title: '',
    body: '……有人吗？\n\n能……听见吗？',
  },
];

/**
 * V1.4：全局剧情宿主不再负责“告诉玩家下一步去哪”。
 *
 * - NPC 能说的话，放进 NPC 对话；
 * - 场景能表现的异常，留在 Story Surface；
 * - 原生 UI 能表现的异常，注入原生 UI；
 * - 这里只保留真正无法错过的强 CG，以及“已经发现之后”的轻量卷宗记录。
 */
export function StoryEventHost() {
  const { story } = useMainStory();
  const [voiceDismissed, setVoiceDismissed] = useState(false);
  const [journalFact, setJournalFact] = useState<string>();
  const initializedFacts = useRef(false);
  const previousFacts = useRef<string[]>([]);
  const compatibilitySent = useRef(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset host UI when story node changes
    setVoiceDismissed(false);
  }, [story?.currentNodeId, story?.currentStep]);

  useEffect(() => {
    const facts = story?.knownFacts ?? [];
    if (!initializedFacts.current) {
      initializedFacts.current = true;
      previousFacts.current = facts;
      return;
    }
    const previous = new Set(previousFacts.current);
    const discovered = facts.filter((fact) => !previous.has(fact));
    previousFacts.current = facts;
    if (discovered.length === 0) return;
    setJournalFact(discovered[discovered.length - 1]);
  }, [story?.knownFacts]);

  useEffect(() => {
    if (!journalFact) return;
    const timer = window.setTimeout(() => setJournalFact(undefined), 4_500);
    return () => window.clearTimeout(timer);
  }, [journalFact]);

  // 兼容 V1.1 已经停在 01-10:pre-breakthrough 的存档。
  useEffect(() => {
    if (!isStoryStep(story, '01-10', 'pre-breakthrough')) {
      compatibilitySent.current = false;
      return;
    }
    if (compatibilitySent.current) return;
    compatibilitySent.current = true;
    void notifyStoryRuntimeEvent({ eventType: 'v1_pre_breakthrough_ready' }).catch(
      (error) => {
        compatibilitySent.current = false;
        console.warn('[main-story] V1.1 pre-breakthrough compatibility failed', error);
      },
    );
  }, [story]);

  const voiceActive = isStoryStep(story, '01-10', 'voice');

  if (voiceActive && !voiceDismissed) {
    return (
      <StoryCinematicStage
        title="有人吗？"
        acts={voiceActs}
        visual="voice"
        finalLabel="记住这两句话"
        onDismiss={() => setVoiceDismissed(true)}
        onFinish={() => {
          void notifyStoryRuntimeEvent({ eventType: 'v1_voice_heard' });
        }}
      />
    );
  }

  if (!journalFact) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[70] w-[min(20rem,calc(100vw-2rem))]">
      <InkCard className="pointer-events-auto border border-current/15 bg-paper/92 p-3 shadow-lg backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-ink-secondary text-[11px] tracking-[0.16em]">
              卷宗已记录
            </p>
            <p className="mt-1 line-clamp-2 text-sm leading-6">{journalFact}</p>
          </div>
          <InkButton
            variant="ghost"
            onClick={() => setJournalFact(undefined)}
          >
            收起
          </InkButton>
        </div>
      </InkCard>
    </div>
  );
}
