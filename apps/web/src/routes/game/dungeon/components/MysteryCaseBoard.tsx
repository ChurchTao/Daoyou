import { InkButton } from '@app/components/ui/InkButton';
import { InkTabs } from '@app/components/ui/InkTabs';
import { InkTag } from '@app/components/ui/InkTag';
import { cn } from '@app/lib/cn';
import type {
  MysteryNpcStatus,
  MysteryPlayerView,
} from '@daoyou/game-domain/dungeon/mystery';
import { useState } from 'react';
import { MysteryLogLine } from './MysteryLogLine';
import { MysteryMiniMap } from './MysteryMiniMap';
import { MysteryPortrait } from './MysteryPortrait';
import type { MysteryNotes } from './useMysteryNotes';

export type MysteryBoardTab = 'clues' | 'people' | 'places' | 'log';

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
  pinnedTo,
  questions,
  onPin,
}: {
  clue: MysteryPlayerView['clues'][number];
  isNew: boolean;
  pinnedTo?: MysteryPlayerView['questions'][number];
  questions: MysteryPlayerView['questions'];
  onPin: (questionId: string | null) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  return (
    <div className="border-ink/15 space-y-1 border px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{clue.name}</span>
        {isNew ? <InkTag tone="bad">新</InkTag> : null}
      </div>
      <p className="text-ink-secondary text-sm leading-7">{clue.text}</p>
      {choosing ? (
        <div className="flex flex-wrap gap-1 text-sm">
          {questions.map((q) => (
            <button
              key={q.id}
              type="button"
              className={cn(
                'border-ink/20 border px-2 py-0.5',
                pinnedTo?.id === q.id && 'border-crimson text-crimson',
              )}
              onClick={() => {
                onPin(pinnedTo?.id === q.id ? null : q.id);
                setChoosing(false);
              }}
            >
              {q.prompt}
            </button>
          ))}
          <button
            type="button"
            className="text-ink-secondary px-2 py-0.5"
            onClick={() => setChoosing(false)}
          >
            取消
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={cn(
            'text-sm',
            pinnedTo ? 'text-crimson' : 'text-ink-secondary hover:text-ink',
          )}
          onClick={() => setChoosing(true)}
        >
          {pinnedTo ? `已作为证据：${pinnedTo.prompt}` : '作为某道题的证据…'}
        </button>
      )}
    </div>
  );
}

/**
 * 案情板：线索按来源归组并可作为推理题的证据，人物、地点与经过各一页。
 * 窄屏放在抽屉里，宽屏常驻在调查页右侧。
 */
export function MysteryCaseBoard({
  view,
  notes,
  tab,
  onTabChange,
  processing,
  onPin,
  onTalk,
  onPresent,
  onUseItem,
  onSelectRoom,
  reachable,
  sceneUrl,
}: {
  view: MysteryPlayerView;
  notes: MysteryNotes;
  tab: MysteryBoardTab;
  onTabChange: (tab: MysteryBoardTab) => void;
  processing: boolean;
  onPin: (clueId: string, questionId: string | null) => void;
  onTalk: (npc: Npc) => void;
  onPresent: (npc: Npc) => void;
  onUseItem: (item: Item) => void;
  onSelectRoom: (roomId: string) => void;
  reachable: ReadonlySet<string>;
  /** 此地的场景插画，地点页顶部的淡墨底图；没有素材时不显示。 */
  sceneUrl?: string;
}) {
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
                  pinnedTo={view.questions.find(
                    (q) => q.id === notes.pins[clue.id],
                  )}
                  questions={view.questions}
                  onPin={(questionId) => onPin(clue.id, questionId)}
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
                  <InkButton
                    variant="outline"
                    disabled={processing}
                    onClick={() => onUseItem(item)}
                  >
                    使用
                  </InkButton>
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
                {present ? (
                  <div className="flex gap-2">
                    <InkButton
                      disabled={processing}
                      onClick={() => onTalk(npc)}
                    >
                      交谈
                    </InkButton>
                    <InkButton
                      variant="outline"
                      disabled={
                        processing ||
                        view.clues.length + view.items.length === 0
                      }
                      onClick={() => onPresent(npc)}
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
              className="h-28 w-full object-cover"
            />
          ) : null}
          <MysteryMiniMap
            map={view.map}
            reachable={reachable}
            disabled={processing}
            onSelect={onSelectRoom}
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
          <div className="border-ink/15 space-y-1 border px-3 py-2 text-sm leading-7">
            <p>
              <span className="text-ink-secondary">身份：</span>
              {view.brief.identity}
            </p>
            <p>
              <span className="text-ink-secondary">目的：</span>
              {view.brief.goal}
            </p>
          </div>
          <div className="space-y-2 text-sm">
            {view.log.map((entry, index) => (
              <MysteryLogLine key={index} entry={entry} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
