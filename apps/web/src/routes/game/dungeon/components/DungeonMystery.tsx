import { InkSection } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkInput } from '@app/components/ui/InkInput';
import { cn } from '@app/lib/cn';
import type {
  MysteryAction,
  MysteryAnswers,
  MysteryLogEntry,
  MysteryPlayerView,
} from '@daoyou/game-domain/dungeon/mystery';
import { useState } from 'react';
import { DungeonMysteryDeduction } from './DungeonMysteryDeduction';
import { DungeonMysteryNotebook } from './DungeonMysteryNotebook';

interface DungeonMysteryProps {
  view: MysteryPlayerView;
  processing: boolean;
  onAct: (action: MysteryAction) => Promise<void>;
  onTalk: (npcId: string, question: string) => Promise<boolean>;
  onDeduce: (answers: MysteryAnswers) => Promise<void>;
  onQuit: () => Promise<boolean>;
}

type Picker =
  | { kind: 'present'; npcId: string; npcName: string }
  | { kind: 'use'; itemId: string; itemName: string };

export function MysteryLogLine({ entry }: { entry: MysteryLogEntry }) {
  if (entry.kind === 'clue' || entry.kind === 'item') {
    return (
      <p className="border-crimson/40 bg-crimson/5 border-l-2 px-3 py-2 text-sm leading-7">
        <span className="text-crimson mr-2 font-semibold">
          {entry.kind === 'clue' ? '获得线索' : '获得物品'}
        </span>
        {entry.text}
      </p>
    );
  }
  if (entry.kind === 'speech') {
    return (
      <p className="leading-8">
        <span className="text-ink font-semibold">{entry.speaker}：</span>
        {entry.text}
      </p>
    );
  }
  if (entry.kind === 'system') {
    return <p className="text-ink-secondary text-sm leading-7">{entry.text}</p>;
  }
  return <p className="text-ink leading-8">{entry.text}</p>;
}

/** 与某人的对话：此人的发言，以及紧接在其回答之前的玩家提问。 */
function dialogueWith(log: MysteryLogEntry[], npcName: string) {
  return log
    .filter(
      (entry, i) =>
        entry.kind === 'speech' &&
        (entry.speaker === npcName ||
          (entry.speaker === '你' && log[i + 1]?.speaker === npcName)),
    )
    .slice(-10);
}

export function DungeonMystery({
  view,
  processing,
  onAct,
  onTalk,
  onDeduce,
  onQuit,
}: DungeonMysteryProps) {
  const [asking, setAsking] = useState<{
    npcId: string;
    npcName: string;
  } | null>(null);
  const [question, setQuestion] = useState('');
  const [notebookOpen, setNotebookOpen] = useState(false);
  const [deducing, setDeducing] = useState(false);
  const [picker, setPicker] = useState<Picker | null>(null);

  const current = view.log.filter((entry) => entry.turn === view.turn);
  const earlier = view.log.filter((entry) => entry.turn !== view.turn);
  const exhausted = view.actionsLeft <= 0;
  const lockedHints = view.exits.filter((exit) => exit.locked && exit.hint);

  const act = async (action: MysteryAction) => {
    setPicker(null);
    await onAct(action);
  };

  return (
    <div className="space-y-5 pb-28">
      <div className="border-ink/15 flex flex-wrap items-center justify-between gap-2 border-b border-dashed pb-3 text-sm">
        <div className="text-ink-secondary">
          {view.title}
          <span className="mx-2">·</span>
          行动力
          <span
            className={cn(
              'ml-1 font-mono font-semibold tracking-tight',
              view.actionsLeft <= 4 ? 'text-crimson' : 'text-ink',
            )}
          >
            {view.actionsLeft}/{view.actionBudget}
          </span>
        </div>
        <div className="flex gap-1">
          <InkButton variant="outline" onClick={() => setNotebookOpen(true)}>
            案卷笔记
            {view.clues.length > 0 ? (
              <span className="ml-1 font-mono">{view.clues.length}</span>
            ) : null}
          </InkButton>
          <InkButton variant="ghost" disabled={processing} onClick={onQuit}>
            离开
          </InkButton>
        </div>
      </div>

      {view.replay ? (
        <p className="text-ink-secondary text-sm">
          此案你已经历过，人物与线索都与上次相同。
        </p>
      ) : null}

      <InkCard className="space-y-3 p-5">
        <div className="text-ink-secondary text-sm">{view.location.name}</div>
        {current.map((entry, index) => (
          <MysteryLogLine key={index} entry={entry} />
        ))}
      </InkCard>

      {exhausted ? (
        <InkCard className="space-y-3 p-5 text-center">
          <p>行动力已尽，把你掌握的线索拼起来，给出推断。</p>
          <InkButton variant="primary" onClick={() => setDeducing(true)}>
            结案推理
          </InkButton>
        </InkCard>
      ) : (
        <InkSection title="此处">
          <div className="space-y-4">
            {view.objects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {view.objects.map((object) => (
                  <InkChoiceButton
                    key={object.id}
                    disabled={processing}
                    onClick={() => act({ type: 'search', objectId: object.id })}
                  >
                    {object.searched ? '再看' : '查看'}
                    {object.name}
                  </InkChoiceButton>
                ))}
              </div>
            ) : null}

            {view.npcsHere.map((npc) => (
              <div
                key={npc.id}
                className="border-ink/15 flex flex-wrap items-center justify-between gap-2 border px-3 py-2"
              >
                <div>
                  <span className="font-semibold">{npc.name}</span>
                  <span className="text-ink-secondary ml-2 text-sm">
                    {npc.title}
                  </span>
                </div>
                <div className="flex gap-1">
                  <InkButton
                    disabled={processing}
                    onClick={() =>
                      setAsking({ npcId: npc.id, npcName: npc.name })
                    }
                  >
                    交谈
                  </InkButton>
                  <InkButton
                    variant="outline"
                    disabled={
                      processing || view.clues.length + view.items.length === 0
                    }
                    onClick={() =>
                      setPicker({
                        kind: 'present',
                        npcId: npc.id,
                        npcName: npc.name,
                      })
                    }
                  >
                    出示
                  </InkButton>
                </div>
              </div>
            ))}

            {view.items.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-secondary">随身</span>
                {view.items.map((item) => (
                  <InkChoiceButton
                    key={item.id}
                    disabled={processing}
                    onClick={() =>
                      setPicker({
                        kind: 'use',
                        itemId: item.id,
                        itemName: item.name,
                      })
                    }
                  >
                    使用{item.name}
                  </InkChoiceButton>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-secondary">去往</span>
              {view.exits.map((exit) => (
                <InkChoiceButton
                  key={exit.id}
                  disabled={processing || exit.locked}
                  onClick={() => act({ type: 'move', roomId: exit.id })}
                >
                  {exit.locked ? '🔒 ' : ''}
                  {exit.name}
                </InkChoiceButton>
              ))}
            </div>
            {lockedHints.map((exit) => (
              <p key={exit.id} className="text-ink-secondary text-sm">
                {exit.name}：{exit.hint}
              </p>
            ))}
          </div>
        </InkSection>
      )}

      {!exhausted ? (
        <div className="text-center">
          <InkButton
            variant="primary"
            disabled={processing}
            onClick={() => setDeducing(true)}
          >
            结案推理
          </InkButton>
        </div>
      ) : null}

      {earlier.length > 0 ? (
        <InkSection title="前情" subdued>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-2 text-sm">
            {earlier.map((entry, index) => (
              <MysteryLogLine key={index} entry={entry} />
            ))}
          </div>
        </InkSection>
      ) : null}

      <DungeonMysteryNotebook
        view={view}
        isOpen={notebookOpen}
        onClose={() => setNotebookOpen(false)}
      />

      <DungeonMysteryDeduction
        view={view}
        isOpen={deducing}
        processing={processing}
        onClose={() => setDeducing(false)}
        onSubmit={onDeduce}
      />

      <InkDetailDrawer
        isOpen={asking !== null}
        onClose={() => setAsking(null)}
        size="md"
        title={asking ? `与${asking.npcName}交谈` : ''}
        description="直接问你想知道的事。每问一句消耗 1 点行动力。"
        footer={
          asking ? (
            <div className="flex w-full flex-wrap items-end gap-2">
              <InkInput
                containerClassName="min-w-0 flex-1"
                value={question}
                maxLength={80}
                placeholder="例如：你昨夜在做什么？"
                onChange={setQuestion}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && question.trim() && !processing) {
                    event.preventDefault();
                    void onTalk(asking.npcId, question.trim()).then(
                      (sent) => sent && setQuestion(''),
                    );
                  }
                }}
              />
              <InkButton
                variant="primary"
                disabled={!question.trim() || processing || exhausted}
                pending={processing}
                pendingLabel="对方思索中……"
                onClick={() =>
                  void onTalk(asking.npcId, question.trim()).then(
                    (sent) => sent && setQuestion(''),
                  )
                }
              >
                问
              </InkButton>
              <InkButton
                variant="ghost"
                disabled={processing || exhausted}
                onClick={() => act({ type: 'talk', npcId: asking.npcId })}
              >
                寒暄
              </InkButton>
            </div>
          ) : null
        }
      >
        {asking ? (
          <div className="space-y-2 text-sm">
            {dialogueWith(view.log, asking.npcName).map((entry, index) => (
              <MysteryLogLine key={index} entry={entry} />
            ))}
            {exhausted ? (
              <p className="text-crimson">行动力已尽，不能再问了。</p>
            ) : null}
          </div>
        ) : null}
      </InkDetailDrawer>

      <InkDetailDrawer
        isOpen={picker !== null}
        onClose={() => setPicker(null)}
        size="sm"
        title={
          picker?.kind === 'present'
            ? `向${picker.npcName}出示`
            : picker
              ? `将${picker.itemName}用在`
              : ''
        }
      >
        <div className="space-y-2">
          {picker?.kind === 'present'
            ? [...view.clues, ...view.items].map((evidence) => (
                <InkChoiceButton
                  key={evidence.id}
                  layout="card"
                  disabled={processing}
                  onClick={() =>
                    act({
                      type: 'present',
                      npcId: picker.npcId,
                      evidenceId: evidence.id,
                    })
                  }
                >
                  <div className="font-semibold">{evidence.name}</div>
                  <div className="text-ink-secondary mt-1 text-sm">
                    {evidence.text}
                  </div>
                </InkChoiceButton>
              ))
            : null}
          {picker?.kind === 'use'
            ? [...view.objects, ...view.npcsHere].map((target) => (
                <InkChoiceButton
                  key={target.id}
                  layout="card"
                  disabled={processing}
                  onClick={() =>
                    act({
                      type: 'use',
                      itemId: picker.itemId,
                      targetId: target.id,
                    })
                  }
                >
                  {target.name}
                </InkChoiceButton>
              ))
            : null}
        </div>
      </InkDetailDrawer>
    </div>
  );
}
