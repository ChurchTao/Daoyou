import { NpcConversation } from '@app/components/feature/room';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkInput } from '@app/components/ui/InkInput';
import type { MysteryPlayerView } from '@daoyou/game-domain/dungeon/mystery';
import { useState } from 'react';
import { mysteryPortraitIcon } from './mysteryArt';
import { mysteryDialogueWith } from './mysteryQuestions';

export function MysteryTalkDrawer({
  npc,
  view,
  processing,
  onClose,
  onTalk,
  onSmallTalk,
}: {
  npc: { id: string; name: string };
  view: MysteryPlayerView;
  processing: boolean;
  onClose(): void;
  onTalk(npcId: string, question: string): Promise<boolean>;
  onSmallTalk(): Promise<void>;
}) {
  const [question, setQuestion] = useState('');
  const localNpc = view.npcsHere.find(({ id }) => id === npc.id);
  const identity = localNpc ?? view.knownNpcs.find(({ id }) => id === npc.id);
  const exhausted = view.actionsLeft <= 0;
  const canSend = Boolean(question.trim()) && !processing && !exhausted;
  const messages = mysteryDialogueWith(view.log, npc.name)
    .map((entry, index) => ({
      id: `${entry.turn}:${index}`,
      body: entry.text,
      speaker: entry.speaker,
      align: entry.speaker === '你' ? ('end' as const) : undefined,
      verbatim: true,
    }))
    .slice(-10);

  async function send() {
    if (!canSend) return;
    const draft = question;
    if (await onTalk(npc.id, draft.trim()))
      setQuestion((current) => (current === draft ? '' : current));
  }

  return (
    <InkDetailDrawer
      isOpen
      onClose={onClose}
      size="md"
      title="交谈"
      footer={
        <>
          <p className="text-ink-secondary mb-2 text-xs leading-5">
            {localNpc?.firstTalkFree
              ? '第一问不耗行动力，之后每问一句耗 1 点。'
              : '每问一句耗 1 点行动力。'}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <InkInput
              aria-label="提问内容"
              containerClassName="min-w-32 flex-1"
              value={question}
              maxLength={80}
              placeholder="你昨夜在做什么？"
              onChange={setQuestion}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <InkButton
              variant="primary"
              disabled={!canSend}
              pending={processing}
              pendingLabel="对方思索中……"
              onClick={() => void send()}
            >
              提问
            </InkButton>
            <InkButton
              variant="ghost"
              disabled={processing || exhausted}
              onClick={() => void onSmallTalk()}
            >
              闲聊几句
            </InkButton>
          </div>
        </>
      }
    >
      <NpcConversation
        presentation="map"
        collapseHistory
        actor={{
          sigil: npc.name.slice(0, 1),
          name: npc.name,
          identity: identity?.title ?? '',
          responsibility: '',
          portrait: mysteryPortraitIcon(identity?.portrait),
        }}
        messages={messages}
        containedTranscript={messages.length > 0}
        busy={processing}
        error={exhausted ? '行动力已尽，不能再问了。' : undefined}
      />
    </InkDetailDrawer>
  );
}
