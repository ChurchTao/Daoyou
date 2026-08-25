import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import { InkNotice } from '@app/components/ui/InkNotice';
import { TypewriterText } from '@app/components/ui/TypewriterText';
import { consumeResourceChanges } from '@app/lib/resources/mutations';
import { getGameConceptInfo } from '@shared/lib/gameConceptDisplay';
import {
  TRAVEL_STORY_REWARD_LABELS,
  type TravelStoryChoiceKey,
  type TravelStoryEvent,
  type TravelStoryReward,
} from '@shared/lib/story/travelStory';
import { useState } from 'react';

export interface ActivityStoryModalProps {
  event: TravelStoryEvent | null;
  isOpen: boolean;
  onClose: () => void;
  onResolved: () => void;
}

type TravelStoryPhase = 'narrative' | 'choices' | 'result';

function RewardDisplay({
  reward,
  activityType,
}: {
  reward: TravelStoryReward;
  activityType: TravelStoryEvent['activityType'];
}) {
  const info = getGameConceptInfo(reward.type);
  return (
    <div className="border-gold/30 bg-gold/5 mt-4 border border-dashed p-3 text-center">
      <span className="text-ink-secondary mr-2 text-sm">
        {activityType === 'travel' ? '途中所得' : '回响所得'}
      </span>
      <span className="text-gold text-lg font-bold">
        {info.icon} {info.label} +{reward.value}
      </span>
    </div>
  );
}

function ActivityStoryModalContent({
  event,
  isOpen,
  onClose,
  onResolved,
}: ActivityStoryModalProps) {
  const { pushToast } = useInkUI();
  const [phase, setPhase] = useState<TravelStoryPhase>(
    event?.status === 'resolved' ? 'result' : 'narrative',
  );
  const [narrativeComplete, setNarrativeComplete] = useState(false);
  const [resultComplete, setResultComplete] = useState(false);
  const [choosing, setChoosing] = useState<TravelStoryChoiceKey | null>(null);
  const [resolvedEvent, setResolvedEvent] = useState<TravelStoryEvent | null>(
    event?.status === 'resolved' ? event : null,
  );

  if (!event) return null;

  const choose = async (choiceKey: TravelStoryChoiceKey) => {
    if (choosing) return;
    setChoosing(choiceKey);
    try {
      const response = await fetch(
        `/api/story/activity-stories/${event.id}/choices`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ choiceKey }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '异闻抉择保存失败');
      }
      if (data.state) consumeResourceChanges(data.state);
      setResolvedEvent(data.event);
      setResultComplete(false);
      setPhase('result');
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '异闻抉择保存失败',
        tone: 'danger',
      });
    } finally {
      setChoosing(null);
    }
  };

  const result = resolvedEvent ?? event;
  const close = () => {
    if (phase === 'result') onResolved();
    onClose();
  };

  return (
    <InkModal
      isOpen={isOpen}
      onClose={close}
      title={event.title}
      footer={
        phase === 'narrative' && narrativeComplete ? (
          <InkButton
            variant="primary"
            className="w-full"
            onClick={() => setPhase('choices')}
          >
            下一步
          </InkButton>
        ) : phase === 'result' && resultComplete ? (
          <InkButton variant="primary" className="w-full" onClick={close}>
            记下此事
          </InkButton>
        ) : undefined
      }
    >
      {event.linkage ? (
        <InkNotice tone="info" className="mb-4">
          {event.linkage.kind === 'mainline_prelude'
            ? '此异闻与当前主线相连，你的选择会影响关联秘境的初始危险。'
            : '这是关联秘境留下的延迟回响，回应后当前章节才会正式归档。'}
        </InkNotice>
      ) : null}
      {!event.linkage && event.activityType !== 'travel' ? (
        <InkNotice tone="info" className="mb-4">
          正式任务或秘境奖励已在原玩法结算；这里仅发放受当前境界预算约束的额外剧情回响。
        </InkNotice>
      ) : null}
      {phase === 'narrative' ? (
        <div className="text-ink bg-ink/5 border-ink/10 min-h-32 border border-dashed p-4 text-sm leading-7">
          <TypewriterText
            key={`travel-narrative-${event.id}`}
            text={event.content}
            speed={32}
            showCursor
            onComplete={() => setNarrativeComplete(true)}
          />
        </div>
      ) : null}

      {phase === 'choices' ? (
        <div>
          <p className="text-ink-secondary mb-3 text-center text-sm">
            抉择时刻
          </p>
          <div className="space-y-3">
            {event.choices.map((choice) => (
              <InkChoiceButton
                key={choice.key}
                layout="card"
                disabled={Boolean(choosing)}
                selected={choosing === choice.key}
                onClick={() => choose(choice.key)}
              >
                <span className="block font-bold">{choice.label}</span>
                <span className="text-ink-secondary mt-1 block text-sm leading-6">
                  {choice.description}
                </span>
                <span className="text-gold mt-2 block text-xs">
                  机缘倾向：{TRAVEL_STORY_REWARD_LABELS[choice.rewardKind]}
                </span>
              </InkChoiceButton>
            ))}
          </div>
        </div>
      ) : null}

      {phase === 'result' ? (
        <div>
          <div className="text-ink bg-ink/5 border-ink/10 min-h-28 border border-dashed p-4 text-sm leading-7">
            <TypewriterText
              key={`travel-result-${event.id}`}
              text={result.selectedOutcome ?? '这段途中异闻已经尘埃落定。'}
              speed={32}
              showCursor
              onComplete={() => setResultComplete(true)}
            />
          </div>
          {result.selectedReward ? (
            <RewardDisplay
              reward={result.selectedReward}
              activityType={result.activityType}
            />
          ) : null}
          {result.linkage && resultComplete ? (
            <InkNotice tone="info" className="mt-4 text-center">
              {result.linkage.kind === 'mainline_prelude'
                ? '关联秘境已经解锁，可回重要剧情信进入。'
                : '延迟回响已经回应，当前主线已归档。'}
            </InkNotice>
          ) : null}
        </div>
      ) : null}
    </InkModal>
  );
}

export function ActivityStoryModal(props: ActivityStoryModalProps) {
  if (!props.event) return null;
  return (
    <ActivityStoryModalContent
      key={`${props.event.id}:${props.isOpen ? 'open' : 'closed'}`}
      {...props}
    />
  );
}

export const TravelStoryModal = ActivityStoryModal;
