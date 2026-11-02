import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkTabs } from '@app/components/ui/InkTabs';
import type { MysteryPlayerView } from '@daoyou/game-domain/dungeon/mystery';
import { useState } from 'react';

interface DungeonMysteryNotebookProps {
  view: MysteryPlayerView;
  isOpen: boolean;
  onClose: () => void;
}

function Empty({ children }: { children: string }) {
  return (
    <p className="text-ink-secondary border-ink/15 border border-dashed px-3 py-4 text-sm">
      {children}
    </p>
  );
}

/** 自动归档的角色本、线索与人物，减少玩家回翻正文的负担。 */
export function DungeonMysteryNotebook({
  view,
  isOpen,
  onClose,
}: DungeonMysteryNotebookProps) {
  const [tab, setTab] = useState('clues');

  return (
    <InkDetailDrawer isOpen={isOpen} onClose={onClose} title="案卷笔记">
      <InkTabs
        className="mb-4"
        activeValue={tab}
        onChange={setTab}
        items={[
          { value: 'clues', label: `线索 ${view.clues.length}` },
          { value: 'people', label: '人物' },
          { value: 'brief', label: '角色本' },
        ]}
      />

      {tab === 'clues' ? (
        <div className="space-y-3">
          {view.clues.length === 0 ? <Empty>尚未发现线索。</Empty> : null}
          {view.clues.map((clue) => (
            <div key={clue.id} className="border-ink/15 border px-3 py-2">
              <div className="font-semibold">{clue.name}</div>
              <p className="text-ink-secondary mt-1 text-sm leading-7">
                {clue.text}
              </p>
            </div>
          ))}
          {view.items.length > 0 ? (
            <div className="pt-2">
              <div className="text-ink-secondary mb-2 text-sm">随身物品</div>
              {view.items.map((item) => (
                <div key={item.id} className="border-ink/15 mb-2 border px-3 py-2">
                  <div className="font-semibold">{item.name}</div>
                  <p className="text-ink-secondary mt-1 text-sm leading-7">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'people' ? (
        <div className="space-y-3">
          {view.knownNpcs.length === 0 ? <Empty>尚未结识任何人。</Empty> : null}
          {view.knownNpcs.map((npc) => {
            const relation = view.brief.relations.find((r) => r.npcId === npc.id);
            return (
              <div key={npc.id} className="border-ink/15 border px-3 py-2">
                <div>
                  <span className="font-semibold">{npc.name}</span>
                  <span className="text-ink-secondary ml-2 text-sm">
                    {npc.title}
                  </span>
                </div>
                {relation ? (
                  <p className="text-ink-secondary mt-1 text-sm leading-7">
                    {relation.text}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {tab === 'brief' ? (
        <div className="space-y-4 text-sm leading-7">
          <div>
            <div className="text-ink-secondary">身份</div>
            <p>{view.brief.identity}</p>
          </div>
          <div>
            <div className="text-ink-secondary">此行目的</div>
            <p>{view.brief.goal}</p>
          </div>
          <div>
            <div className="text-ink-secondary">结案时需回答</div>
            <ul className="list-inside list-disc">
              {view.questions.map((q) => (
                <li key={q.id}>{q.prompt}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-ink-secondary">开场</div>
            <p>{view.brief.opening}</p>
          </div>
        </div>
      ) : null}
    </InkDetailDrawer>
  );
}
