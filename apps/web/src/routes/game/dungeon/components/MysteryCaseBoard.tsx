import { MysteryLogLine } from '@app/components/feature/dungeon/MysteryLogLine';
import { InkButton } from '@app/components/ui/InkButton';
import { InkTabs } from '@app/components/ui/InkTabs';
import { InkTag } from '@app/components/ui/InkTag';
import { cn } from '@app/lib/cn';
import type {
  MysteryLogKind,
  MysteryNpcStatus,
  MysteryPlayerView,
} from '@daoyou/game-domain/dungeon/mystery';
import { useState } from 'react';
import { MysteryBrief } from './MysteryBrief';
import { MysteryMiniMap } from './MysteryMiniMap';
import { MysteryPortrait } from './MysteryPortrait';
import { mysteryDialogueWith, type MysteryQuestion } from './mysteryQuestions';
import { MYSTERY_EVIDENCE_LIMIT, type MysteryNotes } from './useMysteryNotes';

export type MysteryBoardTab = 'brief' | 'clues' | 'people' | 'places' | 'log';

type Npc = MysteryPlayerView['knownNpcs'][number];
type Item = MysteryPlayerView['items'][number];

const STATUS: Record<
  MysteryNpcStatus,
  { label: string; tone: 'neutral' | 'good' | 'bad' | 'info' }
> = {
  unmet: { label: '尚未交谈', tone: 'neutral' },
  talked: { label: '已交谈', tone: 'neutral' },
  opened: { label: '已说出实情', tone: 'good' },
  exposed: { label: '说法被戳穿', tone: 'bad' },
  departed: { label: '已离场', tone: 'neutral' },
};

const NO_ROOMS: ReadonlySet<string> = new Set();

function Empty({ children }: { children: string }) {
  return (
    <p className="text-ink-secondary border-ink/15 border border-dashed px-3 py-4 text-sm">
      {children}
    </p>
  );
}

function ClueCard({
  clue,
  isNew,
  questions,
  evidence,
  activeQuestion,
  onToggle,
}: {
  clue: MysteryPlayerView['clues'][number];
  isNew: boolean;
  questions: MysteryPlayerView['questions'];
  evidence: MysteryNotes['evidence'];
  /** 正在作答的题：此时只问是否作为这道题的证据。 */
  activeQuestion?: MysteryQuestion;
  onToggle: (questionId: string) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const pinned = questions.filter((q) => evidence[q.id]?.includes(clue.id));
  const full = (id: string) =>
    (evidence[id]?.length ?? 0) >= MYSTERY_EVIDENCE_LIMIT;
  const here = activeQuestion && pinned.includes(activeQuestion);
  return (
    <div className="border-ink/15 space-y-1 border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{clue.name}</span>
        {isNew ? <InkTag tone="bad">新</InkTag> : null}
      </div>
      <p className="text-ink-secondary text-sm leading-7">{clue.text}</p>
      {pinned.length > 0 ? (
        <p className="text-crimson text-sm">
          已作为证据：{pinned.map((q) => q.prompt).join('；')}
        </p>
      ) : null}
      {activeQuestion ? (
        <InkButton
          variant={here ? 'secondary' : 'primary'}
          disabled={!here && full(activeQuestion.id)}
          onClick={() => onToggle(activeQuestion.id)}
        >
          {here ? '取消本题证据' : '作为本题证据'}
        </InkButton>
      ) : choosing ? (
        <div className="flex flex-wrap gap-1 text-sm">
          {questions.map((q) => (
            <button
              key={q.id}
              type="button"
              disabled={!pinned.includes(q) && full(q.id)}
              className={cn(
                'border-ink/20 border px-2 py-0.5 disabled:opacity-50',
                pinned.includes(q) && 'border-crimson text-crimson',
              )}
              onClick={() => onToggle(q.id)}
            >
              {q.prompt}
            </button>
          ))}
          <InkButton variant="secondary" onClick={() => setChoosing(false)}>
            收起
          </InkButton>
        </div>
      ) : (
        <InkButton onClick={() => setChoosing(true)}>
          {pinned.length > 0 ? '调整证据' : '作为某道题的证据'}
        </InkButton>
      )}
    </div>
  );
}

const LOG_FILTERS: Record<string, MysteryLogKind[] | null> = {
  全部: null,
  线索: ['clue', 'item'],
  对话: ['speech'],
  异动: ['event', 'omen'],
};

/**
 * 案情板：此行、线索、人物、地点与经过各一页；线索可作为推理题的证据。
 * 窄屏放在抽屉里，宽屏常驻在调查页右侧；推理时以只读方式放在答题旁边，只能选证据。
 */
export function MysteryCaseBoard({
  view,
  notes,
  tab,
  onTabChange,
  processing,
  onToggleEvidence,
  onAnswer,
  onTalk,
  onPresent,
  onUseItem,
  onSelectRoom,
  reachable,
  sceneUrl,
  readOnly = false,
  activeQuestion,
}: {
  view: MysteryPlayerView;
  notes: MysteryNotes;
  tab: MysteryBoardTab;
  onTabChange: (tab: MysteryBoardTab) => void;
  processing: boolean;
  onToggleEvidence: (clueId: string, questionId: string) => void;
  /** 去作答某道题；空字符串表示从第一道没答的开始。 */
  onAnswer?: (questionId: string) => void;
  onTalk?: (npc: Npc) => void;
  onPresent?: (npc: Npc) => void;
  onUseItem?: (item: Item) => void;
  onSelectRoom?: (roomId: string) => void;
  reachable?: ReadonlySet<string>;
  /** 此地的场景插画，地点页顶部的淡墨底图；没有素材时不显示。 */
  sceneUrl?: string;
  readOnly?: boolean;
  activeQuestion?: MysteryQuestion;
}) {
  const [logFilter, setLogFilter] = useState('全部');
  const [openNpc, setOpenNpc] = useState<string | null>(null);
  const unread = view.clues.filter((x) => !notes.seen.includes(x.id)).length;
  const here = new Set(view.npcsHere.map((n) => n.id));
  const groups = new Map<string, MysteryPlayerView['clues']>();
  for (const clue of view.clues) {
    const label = clue.source ? `来自${clue.source.name}` : '其他';
    groups.set(label, [...(groups.get(label) ?? []), clue]);
  }

  return (
    <div className="space-y-4">
      <InkTabs
        activeValue={tab}
        onChange={(value) => onTabChange(value as MysteryBoardTab)}
        items={[
          ...(readOnly ? [] : [{ value: 'brief', label: '此行' }]),
          {
            value: 'clues',
            label:
              unread > 0
                ? `线索 ${view.clues.length}·新${unread}`
                : `线索 ${view.clues.length}`,
          },
          { value: 'people', label: '人物' },
          { value: 'places', label: '地点' },
          { value: 'log', label: '经过' },
        ]}
      />

      {tab === 'brief' && onAnswer ? (
        <MysteryBrief view={view} notes={notes} onAnswer={onAnswer} />
      ) : null}

      {tab === 'clues' ? (
        <div className="space-y-3">
          {view.clues.length === 0 ? (
            <Empty>还没有掌握线索。搜查物件、与人交谈都可能有所收获。</Empty>
          ) : null}
          {[...groups].map(([label, clues]) => (
            <div key={label} className="space-y-2">
              <div className="text-ink-secondary text-sm">{label}</div>
              {clues.map((clue) => (
                <ClueCard
                  key={clue.id}
                  clue={clue}
                  isNew={!notes.seen.includes(clue.id)}
                  questions={view.questions}
                  evidence={notes.evidence}
                  activeQuestion={activeQuestion}
                  onToggle={(questionId) =>
                    onToggleEvidence(clue.id, questionId)
                  }
                />
              ))}
            </div>
          ))}
          {view.items.length > 0 ? (
            <div className="space-y-2">
              <div className="text-ink-secondary text-sm">随身物品</div>
              {view.items.map((item) => (
                <div
                  key={item.id}
                  className="border-ink/15 flex items-start justify-between gap-3 border px-3 py-2"
                >
                  <div>
                    <div className="font-semibold">{item.name}</div>
                    <p className="text-ink-secondary text-sm leading-7">
                      {item.text}
                    </p>
                  </div>
                  {readOnly ? null : (
                    <InkButton
                      variant="outline"
                      disabled={processing}
                      onClick={() => onUseItem?.(item)}
                    >
                      使用
                    </InkButton>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'people' ? (
        <div className="space-y-2">
          {view.knownNpcs.length === 0 ? <Empty>尚未结识任何人。</Empty> : null}
          {view.knownNpcs.map((npc) => {
            const status = STATUS[npc.status];
            const present = here.has(npc.id);
            return (
              <div
                key={npc.id}
                className="border-ink/15 space-y-2 border px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <MysteryPortrait
                    portrait={npc.portrait}
                    name={npc.name}
                    size="md"
                    muted={npc.status === 'departed'}
                  />
                  <div className="min-w-0 flex-1">
                    <div>
                      <span className="font-semibold">{npc.name}</span>
                      <span className="text-ink-secondary ml-2 text-sm">
                        {npc.title}
                        {npc.roomName ? ` · 在${npc.roomName}` : ''}
                      </span>
                    </div>
                    <InkTag tone={status.tone}>{status.label}</InkTag>
                  </div>
                </div>
                {view.brief.relations.find((r) => r.npcId === npc.id) ? (
                  <p className="text-ink-secondary text-sm leading-7">
                    {view.brief.relations.find((r) => r.npcId === npc.id)!.text}
                  </p>
                ) : null}
                {npc.lastLine ? (
                  <p className="text-sm leading-7">“{npc.lastLine}”</p>
                ) : null}
                {npc.lastLine ? (
                  <InkButton
                    variant="secondary"
                    onClick={() =>
                      setOpenNpc(openNpc === npc.id ? null : npc.id)
                    }
                  >
                    {openNpc === npc.id ? '收起对话' : '查看说过的话'}
                  </InkButton>
                ) : null}
                {openNpc === npc.id ? (
                  <div className="bg-ink/5 space-y-2 p-3 text-sm">
                    {mysteryDialogueWith(view.log, npc.name).map(
                      (entry, index) => (
                        <MysteryLogLine key={index} entry={entry} />
                      ),
                    )}
                  </div>
                ) : null}
                {present && !readOnly ? (
                  <div className="flex gap-2">
                    <InkButton
                      disabled={processing}
                      onClick={() => onTalk?.(npc)}
                    >
                      交谈
                    </InkButton>
                    <InkButton
                      variant="outline"
                      disabled={
                        processing ||
                        view.clues.length + view.items.length === 0
                      }
                      onClick={() => onPresent?.(npc)}
                    >
                      出示线索
                    </InkButton>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === 'places' ? (
        <div className="space-y-3">
          {sceneUrl ? (
            <img
              src={sceneUrl}
              alt=""
              aria-hidden="true"
              className="aspect-[2/1] w-full [mask-image:linear-gradient(to_bottom,transparent,black_18%)] object-cover object-bottom"
            />
          ) : null}
          <MysteryMiniMap
            map={view.map}
            reachable={reachable ?? NO_ROOMS}
            disabled={processing || readOnly}
            onSelect={(roomId) => onSelectRoom?.(roomId)}
            large
          />
          {view.map.rooms
            .filter((room) => room.visited)
            .map((room) => (
              <div
                key={room.id}
                className="border-ink/15 flex items-center justify-between gap-2 border px-3 py-2 text-sm"
              >
                <span className={cn(room.here && 'font-semibold')}>
                  {room.name}
                  {room.here ? '（你在此处）' : ''}
                </span>
                <span className="text-ink-secondary">
                  物件{' '}
                  <span className="font-mono">
                    {room.searched}/{room.objects}
                  </span>
                  {room.people > 0 ? ` · 有人 ${room.people}` : ''}
                  {room.disturbed ? ' · 有物被毁' : ''}
                  {room.sealed ? ' · 已被封住' : ''}
                </span>
              </div>
            ))}
        </div>
      ) : null}

      {tab === 'log' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            {Object.keys(LOG_FILTERS).map((label) => (
              <button
                key={label}
                type="button"
                aria-pressed={logFilter === label}
                className={cn(
                  'border px-2 py-0.5',
                  logFilter === label
                    ? 'border-crimson text-crimson'
                    : 'border-ink/20',
                )}
                onClick={() => setLogFilter(label)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-2 text-sm">
            {view.log
              .filter(
                (entry) =>
                  !LOG_FILTERS[logFilter] ||
                  LOG_FILTERS[logFilter]!.includes(entry.kind),
              )
              .map((entry, index) => (
                <MysteryLogLine key={index} entry={entry} />
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
