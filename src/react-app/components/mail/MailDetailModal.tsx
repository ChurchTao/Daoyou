import { InkModal } from '@app/components/layout';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkBadge } from '@app/components/ui/InkBadge';
import { InkButton } from '@app/components/ui/InkButton';
import { InkNotice } from '@app/components/ui/InkNotice';
import { useResourceMutation } from '@app/lib/resources/mutations';
import { getGameConceptIcon } from '@shared/lib/gameConceptDisplay';
import type {
  StoryChoiceKey,
  StoryMailDescriptor,
} from '@shared/lib/story/personalStory';
import { Artifact, Consumable, Material } from '@shared/types/cultivator';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Mail } from './MailList';

interface MailDetailModalProps {
  mail: Mail | null;
  onClose: () => void;
  onUpdate: (mailId: string) => void; // Update list after claim
  onStoryUpdate?: (mailId: string, story: StoryMailDescriptor) => void;
}

export function MailDetailModal({
  mail,
  onClose,
  onUpdate,
  onStoryUpdate,
}: MailDetailModalProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const [selectingChoiceKey, setSelectingChoiceKey] =
    useState<StoryChoiceKey | null>(null);
  const [startingDungeon, setStartingDungeon] = useState(false);
  const [storyOverride, setStoryOverride] =
    useState<StoryMailDescriptor | null>(null);
  const { pushToast, openDialog } = useInkUI();
  const { mutate } = useResourceMutation();
  const navigate = useNavigate();

  if (!mail) return null;

  const hasAttachments = mail.attachments && mail.attachments.length > 0;
  const canClaim = hasAttachments && !mail.isClaimed;
  const story = storyOverride ?? mail.story;

  const applyStoryUpdate = (nextStory: StoryMailDescriptor) => {
    setStoryOverride(nextStory);
    onStoryUpdate?.(mail.id, nextStory);
  };

  const submitStoryChoice = async (choiceKey: StoryChoiceKey) => {
    try {
      setSelectingChoiceKey(choiceKey);
      const response = await fetch('/api/story/choices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentId: story?.intentId, choiceKey }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '剧情选择提交失败');
      }
      applyStoryUpdate(data.story as StoryMailDescriptor);
      pushToast({
        message: '选择已确认，先处理与此信相连的云游线索',
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '剧情选择提交失败',
        tone: 'danger',
      });
    } finally {
      setSelectingChoiceKey(null);
    }
  };

  const confirmStoryChoice = (choiceKey: StoryChoiceKey, label: string) => {
    openDialog({
      title: '确认剧情选择',
      content: `确定选择“${label}”吗？进入关联秘境后不能改为其他处理方式。`,
      confirmLabel: '确认选择',
      cancelLabel: '再想想',
      onConfirm: () => void submitStoryChoice(choiceKey),
    });
  };

  const handleStartStoryDungeon = async () => {
    if (!story) return;
    try {
      setStartingDungeon(true);
      await mutate(
        fetch(`/api/story/intents/${story.intentId}/start-dungeon`, {
          method: 'POST',
        }),
      );
      pushToast({ message: '关联秘境已开启', tone: 'success' });
      onClose();
      navigate('/game/dungeon');
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '关联秘境开启失败',
        tone: 'danger',
      });
    } finally {
      setStartingDungeon(false);
    }
  };

  const handleClaim = async () => {
    try {
      setIsClaiming(true);
      await mutate(
        fetch('/api/cultivator/mail/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mailId: mail.id }),
        }),
      );

      pushToast({ message: '领取成功！', tone: 'success' });
      onUpdate(mail.id);
      onClose();
    } catch (error) {
      console.error('Claim failed', error);
      pushToast({ message: '领取失败', tone: 'danger' });
    } finally {
      setIsClaiming(false);
    }
  };

  // Auto mark read if not read?
  // Maybe handled by parent or useEffect, but typically opening it marks it read.
  // For now let's manually do it via API on mount? Or simpler: do it effectively on close or just assume parent handles it.
  // Implementation Plan said: "POST: Mark mail as read."

  return (
    <InkModal isOpen={!!mail} onClose={onClose} title={mail.title}>
      <div className="mt-2 space-y-4">
        <div className="text-sm opacity-60">
          {new Date(mail.createdAt).toLocaleString()}
        </div>

        {story ? (
          <div className="border-crimson/25 bg-crimson/5 flex flex-wrap items-center gap-2 border border-dashed px-3 py-2 text-sm">
            <InkBadge>{story.frameworkTitle}</InkBadge>
            <span className="text-ink-secondary">
              {story.beatType === 'omen' ? '等待你的决定' : '此段旧事已有回音'}
            </span>
          </div>
        ) : null}

        <div className="text-ink bg-paper border-ink/10 min-h-[100px] border border-dashed p-3 leading-relaxed whitespace-pre-wrap">
          {mail.content}
        </div>

        {hasAttachments && (
          <div className="space-y-2 pt-2">
            <h4 className="text-ink-secondary text-sm font-bold">
              🎁 附赠物品
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {mail.attachments?.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-paper-2 border-ink/10 flex items-center justify-between border border-dashed p-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true">
                      {getGameConceptIcon(item.type) || '🎁'}
                    </span>
                    {item.type === 'spirit_stones' && (
                      <span className="text-ink">{item.name}</span>
                    )}
                    {item.type === 'reputation' && (
                      <span className="text-ink">{item.name}</span>
                    )}
                    {item.type === 'cultivation_exp' && (
                      <span className="text-ink">{item.name}</span>
                    )}
                    {item.type === 'comprehension_insight' && (
                      <span className="text-ink">{item.name}</span>
                    )}
                    {item.type === 'material' && (
                      <InkBadge
                        tier={(item.data as Material)?.rank}
                        hideTierText
                      >
                        {item.name}
                      </InkBadge>
                    )}
                    {item.type === 'consumable' && (
                      <InkBadge
                        tier={(item.data as Consumable)?.quality}
                        hideTierText
                      >
                        {item.name}
                      </InkBadge>
                    )}
                    {item.type === 'artifact' && (
                      <InkBadge
                        tier={(item.data as Artifact)?.quality}
                        hideTierText
                      >
                        {item.name}
                      </InkBadge>
                    )}
                  </div>
                  <span className="opacity-70">x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {mail.isClaimed && (
          <InkNotice tone="info" className="py-2 text-center text-sm">
            已领取
          </InkNotice>
        )}

        {story?.beatType === 'omen' ? (
          <div className="border-ink/15 space-y-3 border-t border-dashed pt-4">
            {story.selectedChoiceKey === 'delay' ? (
              <InkNotice tone="info">
                你已暂缓处理。此信会保留，准备妥当后可重新作出选择。
              </InkNotice>
            ) : story.selectedChoiceKey ? (
              <InkNotice tone="info">
                已确认：
                {story.choices.find(
                  (choice) => choice.key === story.selectedChoiceKey,
                )?.label ?? story.selectedChoiceKey}
              </InkNotice>
            ) : null}

            {story.threadStatus === 'active' &&
            story.status === 'delivered' &&
            !story.canStartDungeon ? (
              <div className="space-y-2">
                {story.choices.map((choice) => (
                  <InkButton
                    key={choice.key}
                    className="w-full justify-start text-left"
                    variant={
                      choice.key === 'intervene_now' ? 'primary' : 'secondary'
                    }
                    pending={selectingChoiceKey === choice.key}
                    pendingLabel="记录选择中……"
                    disabled={Boolean(selectingChoiceKey)}
                    onClick={() => confirmStoryChoice(choice.key, choice.label)}
                  >
                    <span>
                      {choice.label}
                      <span className="mt-1 block text-xs font-normal opacity-70">
                        {choice.description}
                      </span>
                    </span>
                  </InkButton>
                ))}
              </div>
            ) : story.threadStatus === 'paused' ? (
              <div className="space-y-2">
                {story.choices
                  .filter((choice) => choice.key !== 'delay')
                  .map((choice) => (
                    <InkButton
                      key={choice.key}
                      className="w-full justify-start text-left"
                      pending={selectingChoiceKey === choice.key}
                      pendingLabel="记录选择中……"
                      disabled={Boolean(selectingChoiceKey)}
                      onClick={() =>
                        confirmStoryChoice(choice.key, choice.label)
                      }
                    >
                      <span>
                        {choice.label}
                        <span className="mt-1 block text-xs font-normal opacity-70">
                          {choice.description}
                        </span>
                      </span>
                    </InkButton>
                  ))}
              </div>
            ) : null}

            {story.canStartDungeon ? (
              <InkButton
                variant="primary"
                className="w-full"
                pending={startingDungeon}
                pendingLabel="开启关联秘境中……"
                onClick={() => void handleStartStoryDungeon()}
              >
                前往关联秘境
              </InkButton>
            ) : null}
            {story.awaitingTravelPrelude ? (
              <InkNotice tone="info">
                信中方位已在云游途中显出新线索。请回洞府首页完成追查；你的处理方式会改变关联秘境的初始危险。
              </InkNotice>
            ) : null}
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-4">
          {canClaim ? (
            <InkButton
              variant="primary"
              onClick={handleClaim}
              disabled={isClaiming}
            >
              {isClaiming ? '收取中...' : '🎁 收下心意'}
            </InkButton>
          ) : story?.beatType === 'omen' && story.canStartDungeon ? null : (
            <InkButton onClick={onClose}>阅毕</InkButton>
          )}
        </div>
      </div>
    </InkModal>
  );
}
