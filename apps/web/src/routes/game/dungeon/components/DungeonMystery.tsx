import { InkButton } from '@app/components/ui/InkButton';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkInput } from '@app/components/ui/InkInput';
import { cn } from '@app/lib/cn';
import type {
  MysteryAction,
  MysteryAnswers,
  MysteryEvidence,
  MysteryLogEntry,
  MysteryPlayerView,
} from '@daoyou/game-domain/dungeon/mystery';
import { useCallback, useEffect, useState } from 'react';
import { DungeonMysteryDeduction } from './DungeonMysteryDeduction';
import { mysterySceneUrl } from './mysteryArt';
import { MysteryAnomalyVeil, MysteryEventFlash } from './MysteryAtmosphere';
import { MysteryCaseBoard, type MysteryBoardTab } from './MysteryCaseBoard';
import { MysteryClueRail } from './MysteryClueRail';
import { MysteryGuardCard } from './MysteryGuardCard';
import { MysteryLogLine } from './MysteryLogLine';
import { MysteryMechanismScene } from './MysteryMechanismScene';
import { MysteryMiniMap } from './MysteryMiniMap';
import { MysteryPortrait } from './MysteryPortrait';
import {
  MysteryProse,
  type ProseMenuItem,
  type ProseTarget,
} from './MysteryProse';
import { useMysteryGuide } from './useMysteryGuide';
import { useMysteryNotes } from './useMysteryNotes';

interface DungeonMysteryProps {
  view: MysteryPlayerView;
  runId?: string;
  processing: boolean;
  onAct: (action: MysteryAction) => Promise<void>;
  onTalk: (npcId: string, question: string) => Promise<boolean>;
  onDeduce: (
    answers: MysteryAnswers,
    evidence: MysteryEvidence,
  ) => Promise<void>;
  onGuard: (guardId: string) => Promise<void>;
  onQuit: () => Promise<boolean>;
  /** 此地的场景插画类别，用于开局题签与地点页底图。 */
  scene?: string;
}

type Picker =
  | { kind: 'present'; npcId: string; npcName: string }
  | { kind: 'use'; itemId: string; itemName: string }
  | { kind: 'useOn'; targetId: string; targetName: string };

type GuardedExit = MysteryPlayerView['exits'][number] & {
  guard: NonNullable<MysteryPlayerView['exits'][number]['guard']>;
};

/** 行动力：一炷香，烧去的部分越来越短，旁边写明剩余点数。 */
function MysteryIncense({ left, budget }: { left: number; budget: number }) {
  const percent = budget > 0 ? (left / budget) * 100 : 0;
  return (
    <span className="text-ink-secondary flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden className="bg-ink/10 relative h-1 w-14 sm:w-24">
        <span
          className={cn(
            'absolute inset-y-0 left-0 transition-[width] duration-700',
            left <= 2 ? 'bg-crimson' : 'bg-wood',
          )}
          style={{ width: `${percent}%` }}
        />
        {left > 0 ? (
          <span
            className="bg-crimson absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-700"
            style={{ left: `${percent}%` }}
          />
        ) : null}
      </span>
      <span>
        行动力
        <span
          className={cn(
            'ml-1 font-mono font-semibold tracking-tight',
            left <= 2 ? 'text-crimson' : 'text-ink',
          )}
        >
          {left} / {budget}
        </span>
      </span>
    </span>
  );
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

/** ≥1024px 时地图与线索并到右侧一栏常驻，正文独占左侧宽栏。 */
function useMinWidth(px: number) {
  const query = `(min-width: ${px}px)`;
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
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
  scene,
}: DungeonMysteryProps) {
  const sceneUrl = mysterySceneUrl(scene);
  const wide = useMinWidth(1024);
  const { notes, pin, markSeen } = useMysteryNotes(runId);
  const [asking, setAsking] = useState<{
    npcId: string;
    npcName: string;
  } | null>(null);
  const askingPortrait = view.knownNpcs.find(
    (n) => n.id === asking?.npcId,
  )?.portrait;
  const [question, setQuestion] = useState('');
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardTab, setBoardTab] = useState<MysteryBoardTab>('clues');
  const [deducing, setDeducing] = useState(false);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [guarded, setGuarded] = useState<GuardedExit | null>(null);
  const [operating, setOperating] = useState<string | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const exhausted = view.actionsLeft <= 0;
  const operatingMechanism =
    view.objects.find((o) => o.mechanism?.id === operating)?.mechanism ?? null;
  const closeMechanism = useCallback(() => setOperating(null), []);
  const closeGuard = useCallback(() => setGuarded(null), []);
  const busy = processing || exhausted;
  // 正文从进入当前地点那一回合讲起（开局时含开场白）。
  let lastScene = view.log.length - 1;
  while (lastScene > 0 && view.log[lastScene]!.kind !== 'scene') lastScene--;
  const sceneTurn = view.log[lastScene]?.turn ?? view.turn;
  const segmentStart = Math.max(
    0,
    view.log.findIndex((entry) => entry.turn === sceneTurn),
  );
  const segment = view.log.slice(segmentStart);
  const reachable = new Set(
    view.exits.filter((exit) => !exit.locked).map((exit) => exit.id),
  );
  const unread = view.clues.filter((x) => !notes.seen.includes(x.id));
  // 打开案情板的线索页，或宽屏右栏常驻时，新线索数秒后视为已读。
  const cluesVisible = (boardOpen && boardTab === 'clues') || wide;
  const clueIds = [...view.clues, ...view.items].map((x) => x.id).join();
  const spent = view.actionBudget - view.actionsLeft;
  const guide = useMysteryGuide({
    act: !exhausted,
    board: view.clues.length + view.items.length > 0,
    deduce: view.clues.length >= 3 || spent * 2 >= view.actionBudget,
  });

  useEffect(() => {
    if (!cluesVisible || !clueIds) return;
    const timer = window.setTimeout(() => markSeen(clueIds.split(',')), 3000);
    return () => window.clearTimeout(timer);
  }, [cluesVisible, clueIds, markSeen]);

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

  const targets: ProseTarget[] = [
    ...view.objects.map((o) => ({
      key: `o:${o.id}`,
      name: o.name,
      kind: 'object' as const,
    })),
    ...view.npcsHere.map((n) => ({
      key: `n:${n.id}`,
      name: n.name,
      kind: 'npc' as const,
    })),
    ...view.exits.map((e) => ({
      key: `e:${e.id}`,
      name: e.name,
      kind: 'exit' as const,
      muted: e.locked,
    })),
    // 被毁去的物件与离场的人，名字在正文里划去。
    ...[
      ...view.lost,
      ...view.knownNpcs
        .filter((n) => n.status === 'departed')
        .map((n) => n.name),
    ].map((name) => ({ key: `g:${name}`, name, kind: 'gone' as const })),
  ];
  const soonest = view.alerts.reduce<number | null>(
    (min, a) => (min === null ? a.turnsLeft : Math.min(min, a.turnsLeft)),
    null,
  );

  const COST = '耗 1 行动力';
  const itemUseMenu = (id: string, name: string): ProseMenuItem[] =>
    view.items.length > 0
      ? [
          {
            label: '对其使用物品…',
            note: COST,
            disabled: busy,
            onSelect: () =>
              setPicker({ kind: 'useOn', targetId: id, targetName: name }),
          },
        ]
      : [];

  const menuFor = (target: ProseTarget): ProseMenuItem[] => {
    const id = target.key.slice(2);
    if (target.kind === 'object') {
      const object = view.objects.find((o) => o.id === id);
      if (!object) return [];
      const m = object.mechanism;
      return [
        object.searched
          ? {
              label: '再看一遍',
              note: '不耗行动力',
              disabled: busy,
              onSelect: () => act({ type: 'search', objectId: id }),
            }
          : {
              label: '调查',
              note: COST,
              disabled: busy,
              onSelect: () => act({ type: 'search', objectId: id }),
            },
        ...(m
          ? [
              m.solved
                ? { label: '机关已开启' }
                : m.locked
                  ? { label: '机关已锁死' }
                  : {
                      label: '解开机关',
                      note: '按错多耗 1 点',
                      disabled: busy,
                      onSelect: () => setOperating(m.id),
                    },
            ]
          : []),
        ...itemUseMenu(id, object.name),
      ];
    }
    if (target.kind === 'npc') {
      const npc = view.npcsHere.find((n) => n.id === id);
      if (!npc) return [];
      return [
        {
          label: '交谈',
          note: '每问一句耗 1 点',
          disabled: busy,
          onSelect: () => startTalk(npc),
        },
        {
          label: '出示线索…',
          note: COST,
          disabled: busy || view.clues.length + view.items.length === 0,
          onSelect: () => startPresent(npc),
        },
        ...itemUseMenu(id, npc.name),
        { label: '查看人物资料', onSelect: () => openBoard('people') },
      ];
    }
    const exit = view.exits.find((e) => e.id === id);
    if (!exit) return [];
    if (exit.locked) return [{ label: exit.hint ?? '暂时进不去' }];
    return [
      {
        label: `前往${exit.name}`,
        note: exit.guard ? `${exit.guard.name}拦路` : COST,
        disabled: busy,
        onSelect: () => goTo(id),
      },
    ];
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
      sceneUrl={sceneUrl}
    />
  );

  return (
    <div
      className={cn(
        wide &&
          'grid grid-cols-[minmax(0,46rem)_18rem] items-start justify-center gap-10',
      )}
    >
      <div className="flex min-h-[70dvh] flex-col gap-5 lg:min-h-0">
        <div className="border-ink/15 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-dashed pb-3 text-sm">
          {wide ? (
            <span className="text-ink-secondary">{view.location.name}</span>
          ) : (
            <button
              type="button"
              className="text-ink-secondary hover:text-ink"
              onClick={() => openBoard('places')}
            >
              {view.location.name}
              <span className="ml-1 underline decoration-dotted underline-offset-4">
                地图
              </span>
            </button>
          )}
          <div className="relative flex items-center gap-3">
            {soonest !== null ? (
              <button
                type="button"
                aria-expanded={alertsOpen}
                className="text-crimson flex items-center gap-1.5"
                onClick={() => setAlertsOpen((open) => !open)}
              >
                <span className="bg-crimson inline-block size-1.5 animate-pulse rounded-full" />
                {soonest <= 1 ? '异动将至' : `异动 · ${soonest} 步后`}
              </button>
            ) : null}
            {alertsOpen && view.alerts.length > 0 ? (
              <div
                role="status"
                className="bg-paper border-crimson/40 absolute top-full right-0 z-20 mt-2 w-72 max-w-[80vw] space-y-2 border p-3 text-sm leading-7 shadow-[0_8px_24px_rgba(44,24,16,0.12)]"
              >
                {view.alerts.map((alert) => (
                  <p key={alert.id}>
                    {alert.text}
                    <span className="text-ink-secondary ml-1">
                      {alert.turnsLeft <= 1
                        ? '（下一步就会发生）'
                        : `（再行动 ${alert.turnsLeft} 次后发生）`}
                    </span>
                  </p>
                ))}
                <p className="text-ink-secondary">
                  查明真相或找到对策，或许能阻止它。
                </p>
              </div>
            ) : null}
            <MysteryIncense
              left={view.actionsLeft}
              budget={view.actionBudget}
            />
          </div>
          {/* 顶部返回条在剧本进行中隐去：返回洞府保留进度，结束探索则就此结算。窄屏单独一行。 */}
          <div className="flex w-full justify-end sm:w-auto">
            <InkButton variant="ghost" href="/game">
              返回洞府
            </InkButton>
            <InkButton variant="ghost" disabled={processing} onClick={onQuit}>
              结束探索
            </InkButton>
          </div>
        </div>

        {view.replay ? (
          <p className="text-ink-secondary text-sm">
            此案你已经历过，人物与线索都与上次相同。
          </p>
        ) : null}

        {view.actionsLeft > 0 && view.actionsLeft <= 2 ? (
          <p role="status" className="text-crimson text-sm">
            行动力只剩 {view.actionsLeft} 点了，可以考虑提交推理。
          </p>
        ) : null}

        {guide.step ? (
          <p
            role="status"
            className="border-wood/50 bg-wood/5 flex items-start justify-between gap-3 border-l-2 px-3 py-2 text-sm leading-7"
          >
            <span>
              {guide.step.id === 'board' && wide
                ? '拿到的线索会自动记进右侧的案情板，随时可以翻看和整理。'
                : guide.step.text}
            </span>
            <InkButton
              variant="secondary"
              className="shrink-0"
              onClick={() => guide.dismiss(guide.step!.id)}
            >
              知道了
            </InkButton>
          </p>
        ) : null}

        {/* 有场景底图时每个地点都垫着，留住氛围；没有底图时只在开局写案名。 */}
        {sceneUrl || view.turn === 0 ? (
          <div
            className={cn(
              'flex items-center justify-center',
              // 底图为 3:2，主体在两侧与下缘、上方多为留白：以 2:1 取景贴底裁去上缘，保留整幅宽度；
              // 裁切处渐隐，避免截断的墨迹留下直边。
              sceneUrl &&
                'aspect-[2/1] [mask-image:linear-gradient(to_bottom,transparent,black_18%)] bg-cover bg-bottom',
            )}
            style={
              sceneUrl ? { backgroundImage: `url(${sceneUrl})` } : undefined
            }
          >
            <p className="text-ink-secondary text-center text-sm tracking-[0.3em]">
              {view.title}
            </p>
          </div>
        ) : null}

        {segmentStart > 0 ? (
          <InkButton
            variant="secondary"
            className="self-start"
            onClick={() => openBoard('log')}
          >
            回看之前的经过
          </InkButton>
        ) : null}

        <div className="w-full max-w-2xl self-center text-[1.0625rem]">
          <MysteryProse
            entries={segment}
            turn={view.turn}
            targets={targets}
            menuFor={menuFor}
            footer={
              processing ? (
                <p
                  aria-label="正在推演"
                  className="text-ink-secondary animate-pulse tracking-[0.5em]"
                >
                  ……
                </p>
              ) : exhausted ? (
                <div className="space-y-3 pt-2 text-center">
                  <p>
                    行动力已用完，调查到此为止。对照案情板想一想，然后提交推理。
                  </p>
                  <InkButton
                    variant="primary"
                    onClick={() => setDeducing(true)}
                  >
                    提交推理
                  </InkButton>
                </div>
              ) : null
            }
          />
        </div>

        <div className="bg-paper border-ink/15 sticky bottom-0 z-10 -mx-3 mt-auto flex justify-between gap-1 border-t px-3 py-2 lg:static lg:mx-0 lg:justify-end lg:gap-4 lg:border-0 lg:bg-transparent lg:px-0">
          {wide ? null : (
            <InkButton variant="ghost" onClick={() => openBoard('clues')}>
              线索与人物
              {unread.length > 0 ? (
                <span
                  aria-label="有新线索"
                  className="bg-crimson ml-1 inline-block size-1.5 rounded-full align-super"
                />
              ) : null}
            </InkButton>
          )}
          <InkButton
            variant="secondary"
            disabled={busy}
            onClick={() => act({ type: 'reflect' })}
          >
            提示
          </InkButton>
          <InkButton
            variant="primary"
            disabled={processing}
            onClick={() => setDeducing(true)}
          >
            提交推理
          </InkButton>
        </div>
      </div>

      {wide ? (
        <aside className="sticky top-4 max-h-[calc(100dvh-2rem)] space-y-8 overflow-y-auto">
          <section className="space-y-2 opacity-60 transition-opacity duration-500 focus-within:opacity-100 hover:opacity-100">
            <div className="text-ink-secondary text-sm">地图</div>
            <MysteryMiniMap
              map={view.map}
              reachable={reachable}
              disabled={busy}
              onSelect={goTo}
            />
            <p className="text-ink-secondary text-xs">点相邻的房间可以前往</p>
          </section>
          <div className="border-ink/15 border-t border-dashed pt-6">
            <MysteryClueRail view={view} seen={notes.seen} onOpen={openBoard} />
          </div>
        </aside>
      ) : null}

      <InkDetailDrawer
        isOpen={boardOpen}
        onClose={() => setBoardOpen(false)}
        size="md"
        title="案情板"
        description="线索、人物、地点与调查经过都记在这里。"
      >
        {board}
      </InkDetailDrawer>

      <DungeonMysteryDeduction
        view={view}
        pins={notes.pins}
        onPin={pin}
        isOpen={deducing}
        processing={processing}
        onClose={() => setDeducing(false)}
        onSubmit={onDeduce}
      />

      <InkDetailDrawer
        isOpen={asking !== null}
        onClose={() => setAsking(null)}
        size="md"
        title={
          asking ? (
            <span className="flex items-center gap-3">
              <MysteryPortrait
                portrait={askingPortrait}
                name={asking.npcName}
                size="md"
              />
              与{asking.npcName}交谈
            </span>
          ) : (
            ''
          )
        }
        description="直接问你想知道的事，每问一句耗 1 点行动力。"
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
                提问
              </InkButton>
              <InkButton
                variant="ghost"
                disabled={processing || exhausted}
                onClick={() => act({ type: 'talk', npcId: asking.npcId })}
              >
                闲聊几句
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

      <MysteryEventFlash
        turn={view.turn}
        happened={view.log.some(
          (entry) => entry.turn === view.turn && entry.kind === 'event',
        )}
      />
      {view.anomaly ? <MysteryAnomalyVeil {...view.anomaly} /> : null}

      {operatingMechanism ? (
        <MysteryMechanismScene
          key={operatingMechanism.id}
          mechanism={operatingMechanism}
          lines={view.log.filter((entry) => entry.turn === view.turn)}
          processing={processing}
          actionsLeft={view.actionsLeft}
          onClose={closeMechanism}
          onSubmit={(mechanismId, sequence) =>
            onAct({ type: 'operate', mechanismId, sequence })
          }
        />
      ) : null}

      {guarded ? (
        <MysteryGuardCard
          guard={guarded.guard}
          roomName={guarded.name}
          processing={processing}
          exhausted={exhausted}
          onFight={() => {
            const id = guarded.guard.id;
            setGuarded(null);
            void onGuard(id);
          }}
          onBypass={() =>
            act({ type: 'bypass_guard', guardId: guarded.guard.id })
          }
          onClose={closeGuard}
        />
      ) : null}

      <InkDetailDrawer
        isOpen={picker !== null}
        onClose={() => setPicker(null)}
        size="sm"
        title={
          picker?.kind === 'present'
            ? `向${picker.npcName}出示哪条线索`
            : picker?.kind === 'useOn'
              ? `对${picker.targetName}使用哪件物品`
              : picker
                ? `把${picker.itemName}用在哪里`
                : ''
        }
        description="耗 1 点行动力。"
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
          {picker?.kind === 'useOn'
            ? view.items.map((item) => (
                <InkChoiceButton
                  key={item.id}
                  layout="card"
                  disabled={processing}
                  onClick={() =>
                    act({
                      type: 'use',
                      itemId: item.id,
                      targetId: picker.targetId,
                    })
                  }
                >
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-ink-secondary mt-1 text-sm">
                    {item.text}
                  </div>
                </InkChoiceButton>
              ))
            : null}
        </div>
      </InkDetailDrawer>
    </div>
  );
}
