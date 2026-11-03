import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkInput } from '@app/components/ui/InkInput';
import { InkTag } from '@app/components/ui/InkTag';
import { cn } from '@app/lib/cn';
import type {
  MysteryAction,
  MysteryAnswers,
  MysteryLogEntry,
  MysteryPlayerView,
} from '@daoyou/game-domain/dungeon/mystery';
import { useEffect, useState } from 'react';
import { DungeonMysteryDeduction } from './DungeonMysteryDeduction';
import {
  MysteryCaseBoard,
  MysterySeal,
  type MysteryBoardTab,
} from './MysteryCaseBoard';
import { MysteryLogLine } from './MysteryLogLine';
import { MysteryMiniMap } from './MysteryMiniMap';
import { useMysteryNotes } from './useMysteryNotes';

interface DungeonMysteryProps {
  view: MysteryPlayerView;
  runId?: string;
  processing: boolean;
  onAct: (action: MysteryAction) => Promise<void>;
  onTalk: (npcId: string, question: string) => Promise<boolean>;
  onDeduce: (answers: MysteryAnswers) => Promise<void>;
  onGuard: (guardId: string) => Promise<void>;
  onQuit: () => Promise<boolean>;
}

type Picker =
  | { kind: 'present'; npcId: string; npcName: string }
  | { kind: 'use'; itemId: string; itemName: string };

type GuardedExit = MysteryPlayerView['exits'][number] & {
  guard: NonNullable<MysteryPlayerView['exits'][number]['guard']>;
};

const STATUS_LABEL = {
  unmet: '',
  talked: '',
  opened: '已交底',
  exposed: '谎言被戳穿',
  departed: '已离场',
} as const;

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

/** 宽屏时案情板常驻右栏，窄屏时收进抽屉。 */
function useWideScreen() {
  const query = '(min-width: 1024px)';
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}

export function DungeonMystery({
  view,
  runId,
  processing,
  onAct,
  onTalk,
  onDeduce,
  onGuard,
  onQuit,
}: DungeonMysteryProps) {
  const wide = useWideScreen();
  const { notes, pin, markSeen } = useMysteryNotes(runId);
  const [asking, setAsking] = useState<{
    npcId: string;
    npcName: string;
  } | null>(null);
  const [question, setQuestion] = useState('');
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardTab, setBoardTab] = useState<MysteryBoardTab>('clues');
  const [deducing, setDeducing] = useState(false);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [guarded, setGuarded] = useState<GuardedExit | null>(null);

  const current = view.log.filter((entry) => entry.turn === view.turn);
  const exhausted = view.actionsLeft <= 0;
  const lockedHints = view.exits.filter((exit) => exit.locked && exit.hint);
  const reachable = new Set(
    view.exits.filter((exit) => !exit.locked).map((exit) => exit.id),
  );
  const unread = view.clues.filter((x) => !notes.seen.includes(x.id));
  const boardVisible = wide || boardOpen;
  const clueIds = [...view.clues, ...view.items].map((x) => x.id).join();

  // 线索页展示数秒后视为已读，宽屏常驻时新线索也有片刻“新”标记。
  useEffect(() => {
    if (!boardVisible || boardTab !== 'clues' || !clueIds) return;
    const timer = window.setTimeout(() => markSeen(clueIds.split(',')), 3000);
    return () => window.clearTimeout(timer);
  }, [boardVisible, boardTab, clueIds, markSeen]);

  const act = async (action: MysteryAction) => {
    setPicker(null);
    setGuarded(null);
    await onAct(action);
  };

  const goTo = (roomId: string) => {
    const exit = view.exits.find((e) => e.id === roomId);
    if (!exit || exit.locked) return;
    if (exit.guard) setGuarded({ ...exit, guard: exit.guard });
    else void act({ type: 'move', roomId });
  };

  const openBoard = (tab: MysteryBoardTab) => {
    setBoardTab(tab);
    setBoardOpen(true);
  };

  const startTalk = (npc: { id: string; name: string }) => {
    setBoardOpen(false);
    setAsking({ npcId: npc.id, npcName: npc.name });
  };

  const startPresent = (npc: { id: string; name: string }) => {
    setBoardOpen(false);
    setPicker({ kind: 'present', npcId: npc.id, npcName: npc.name });
  };

  // 出示时，得自此人或其所在地点的证据排在前面，其余按新到旧。
  const evidenceFor = (npcId: string) => {
    const roomId = view.knownNpcs.find((n) => n.id === npcId)?.roomId;
    const rank = (x: MysteryPlayerView['clues'][number]) =>
      x.source?.id === npcId ? 0 : x.source?.id === roomId ? 1 : 2;
    return [...view.clues, ...view.items]
      .map((x, i) => ({ x, i }))
      .sort((a, b) => rank(a.x) - rank(b.x) || b.i - a.i)
      .map(({ x }) => x);
  };

  const board = (
    <MysteryCaseBoard
      view={view}
      notes={notes}
      tab={boardTab}
      onTabChange={setBoardTab}
      processing={processing}
      onPin={pin}
      onTalk={startTalk}
      onPresent={startPresent}
      onUseItem={(item) => {
        setBoardOpen(false);
        setPicker({ kind: 'use', itemId: item.id, itemName: item.name });
      }}
      onSelectRoom={(roomId) => {
        setBoardOpen(false);
        goTo(roomId);
      }}
      reachable={reachable}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
      <div className="space-y-4">
        <div className="border-ink/15 flex flex-wrap items-center justify-between gap-2 border-b border-dashed pb-3 text-sm">
          <div className="text-ink-secondary">
            {view.title}
            <span className="mx-2">·</span>
            {view.location.name}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-ink-secondary">
              行动力
              <span
                className={cn(
                  'ml-1 font-mono font-semibold tracking-tight',
                  view.actionsLeft <= 4 ? 'text-crimson' : 'text-ink',
                )}
              >
                {view.actionsLeft}/{view.actionBudget}
              </span>
            </span>
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

        {view.alerts.map((alert) => (
          <p
            key={alert.id}
            role="status"
            className="border-crimson/50 bg-crimson/5 border-l-2 px-3 py-2 text-sm leading-7"
          >
            <span className="text-crimson mr-2 font-semibold">异动</span>
            {alert.text}
          </p>
        ))}

        <MysteryMiniMap
          map={view.map}
          reachable={reachable}
          disabled={processing || exhausted}
          onSelect={goTo}
        />

        <InkCard className="space-y-3 p-5">
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
          <div className="space-y-3">
            {view.objects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {view.objects.map((object) => (
                  <InkChoiceButton
                    key={object.id}
                    disabled={processing}
                    onClick={() => act({ type: 'search', objectId: object.id })}
                  >
                    {object.searched
                      ? `再看${object.name} ✓`
                      : `查看${object.name}`}
                  </InkChoiceButton>
                ))}
              </div>
            ) : null}

            {view.npcsHere.map((here) => {
              const npc = view.knownNpcs.find((n) => n.id === here.id);
              const status = npc ? STATUS_LABEL[npc.status] : '';
              return (
                <div
                  key={here.id}
                  className="border-ink/15 flex flex-wrap items-center gap-3 border px-3 py-2"
                >
                  <MysterySeal name={here.name} />
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold">{here.name}</span>
                    <span className="text-ink-secondary ml-2 text-sm">
                      {here.title}
                    </span>
                    {status ? (
                      <InkTag
                        className="ml-2"
                        tone={npc?.status === 'exposed' ? 'bad' : 'good'}
                      >
                        {status}
                      </InkTag>
                    ) : null}
                  </div>
                  <div className="flex gap-1">
                    <InkButton
                      disabled={processing}
                      onClick={() => startTalk(here)}
                    >
                      交谈
                    </InkButton>
                    <InkButton
                      variant="outline"
                      disabled={
                        processing ||
                        view.clues.length + view.items.length === 0
                      }
                      onClick={() => startPresent(here)}
                    >
                      出示
                    </InkButton>
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-ink-secondary">去往</span>
              {view.exits.map((exit) => (
                <InkChoiceButton
                  key={exit.id}
                  disabled={processing || exit.locked}
                  onClick={() => goTo(exit.id)}
                >
                  {exit.locked ? '🔒 ' : exit.guard ? '⚔️ ' : ''}
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
        )}

        <div className="bg-paper border-ink/15 sticky bottom-0 z-10 -mx-3 grid grid-cols-4 gap-1 border-t px-3 py-2 lg:static lg:mx-0 lg:grid-cols-2 lg:border-0 lg:px-0">
          <InkButton
            variant="ghost"
            className="lg:hidden"
            onClick={() => openBoard('places')}
          >
            地图
          </InkButton>
          <InkButton
            variant="ghost"
            className="lg:hidden"
            onClick={() => openBoard('clues')}
          >
            案情板
            {unread.length > 0 ? (
              <span className="text-crimson ml-1 font-mono">
                {unread.length}
              </span>
            ) : null}
          </InkButton>
          <InkButton
            variant="secondary"
            disabled={processing || exhausted}
            onClick={() => act({ type: 'reflect' })}
          >
            静思
          </InkButton>
          <InkButton
            variant="primary"
            disabled={processing}
            onClick={() => setDeducing(true)}
          >
            结案
          </InkButton>
        </div>
      </div>

      {wide ? (
        <aside className="border-ink/15 sticky top-4 max-h-[calc(100dvh-8rem)] overflow-y-auto border-l pl-6">
          {board}
        </aside>
      ) : (
        <InkDetailDrawer
          isOpen={boardOpen}
          onClose={() => setBoardOpen(false)}
          title="案情板"
        >
          {board}
        </InkDetailDrawer>
      )}

      <DungeonMysteryDeduction
        view={view}
        pins={notes.pins}
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
        isOpen={guarded !== null}
        onClose={() => setGuarded(null)}
        size="sm"
        title={
          guarded ? `${guarded.guard.name}拦住了去${guarded.name}的路` : ''
        }
        description="强闯将进入一场战斗，化解需要相应的线索或物品；两者都消耗 1 点行动力。"
        footer={
          guarded ? (
            <div className="flex flex-wrap gap-2">
              <InkButton
                variant="primary"
                disabled={processing || exhausted}
                onClick={() => {
                  const id = guarded.guard.id;
                  setGuarded(null);
                  void onGuard(id);
                }}
              >
                强闯
              </InkButton>
              <InkButton
                disabled={processing || exhausted || !guarded.guard.canBypass}
                onClick={() =>
                  act({ type: 'bypass_guard', guardId: guarded.guard.id })
                }
              >
                化解
              </InkButton>
              <InkButton variant="ghost" onClick={() => setGuarded(null)}>
                回头
              </InkButton>
            </div>
          ) : null
        }
      >
        {guarded ? (
          <div className="space-y-2 text-sm leading-7">
            <p>{guarded.guard.description}</p>
            <p className="text-ink-secondary">
              {guarded.guard.canBypass
                ? '你已有化解它的办法。'
                : '你还没有化解它的办法，也许线索就在别处。'}
            </p>
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
            ? evidenceFor(picker.npcId).map((evidence) => (
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
