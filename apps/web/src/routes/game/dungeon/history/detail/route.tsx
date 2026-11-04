import { DungeonMysteryResult } from '@app/components/feature/dungeon/DungeonMysteryResult';
import { MysteryLogLine } from '@app/components/feature/dungeon/MysteryLogLine';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { GameLoadingState, GameSceneFrame } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { usePlayerSession } from '@app/lib/resources/player';
import type { DungeonHistoryDetail } from '@daoyou/contracts/dungeon/history';
import { getResourceTypeLabel } from '@daoyou/game-content/presentation/concepts';
import type { MysteryLogEntry } from '@daoyou/game-domain/dungeon/mystery';
import { dungeonRewardItemName } from '@daoyou/game-rules/rewards/dungeon';
import { useParams, useSearchParams } from 'react-router';
import { historyDate, historyPage, useHistory } from '../useHistory';

export default function DungeonHistoryDetailPage() {
  const owner = usePlayerSession().data?.activeCultivator?.id;
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const page = historyPage(params.get('page'));
  return owner ? (
    <HistoryDetail key={`${owner}:${id}`} owner={owner} id={id} page={page} />
  ) : null;
}

function HistoryDetail({
  owner,
  id,
  page,
}: {
  owner: string;
  id: string;
  page: number;
}) {
  const { data, error, retry } = useHistory<DungeonHistoryDetail>(
    `/api/dungeon/history/${encodeURIComponent(id)}`,
    owner,
  );
  const mystery = data?.result.mystery;
  return (
    <GameSceneFrame
      variant="lite"
      identityOverride={
        data
          ? {
              label: mystery?.title ?? data.theme,
              summary: `${data.theme} · ${historyDate(data.createdAt)}`,
            }
          : undefined
      }
      headerMeta={
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <InkButton
            href={`/game/dungeon/history${page > 1 ? `?page=${page}` : ''}`}
            variant="ghost"
          >
            返回札记
          </InkButton>
          {data?.result.settlement?.reward_tier ? (
            <span className="text-ink-secondary">
              探险评价{' '}
              <span className="font-mono">
                {data.result.settlement.reward_tier}
              </span>
            </span>
          ) : null}
        </div>
      }
    >
      {error ? (
        <div role="alert">
          <InkNotice tone="danger">{error}</InkNotice>
          <InkButton onClick={retry}>重新翻阅</InkButton>
        </div>
      ) : !data ? (
        <GameLoadingState message="正在展开这卷札记……" variant="inline" />
      ) : (
        <>
          {data.result.settlement?.performance_tags?.length ? (
            <p className="text-ink-secondary text-sm">
              {data.result.settlement.performance_tags.join(' · ')}
            </p>
          ) : null}
          <p className="text-sm leading-8 whitespace-pre-line">
            {data.result.ending_narrative || '此行已结束。'}
          </p>
          {mystery?.result ? (
            <DungeonMysteryResult result={mystery.result} />
          ) : mystery ? (
            <InkNotice>此行未完成推理结案，未留下评分与答案解析。</InkNotice>
          ) : null}
          <HistoryRewards record={data} />
          {mystery ? (
            <>
              <details className="border-ink/15 border-t border-dashed pt-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  已获线索 ·{' '}
                  <span className="font-mono">{mystery.clues.length}</span> 条
                </summary>
                {mystery.clues.length ? (
                  <dl className="mt-3 space-y-4 text-sm">
                    {mystery.clues.map((clue) => (
                      <div key={clue.id}>
                        <dt className="font-semibold">
                          {clue.name}
                          {clue.source ? (
                            <span className="text-ink-secondary ml-2 font-normal">
                              来自{clue.source.name}
                            </span>
                          ) : null}
                        </dt>
                        <dd className="text-ink-secondary mt-1 leading-7">
                          {clue.text}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <InkNotice>此行未获得线索。</InkNotice>
                )}
              </details>
              <details
                className="border-ink/15 border-t border-dashed pt-4"
                open
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  调查经过 · <span className="font-mono">{mystery.turn}</span>{' '}
                  次行动
                </summary>
                <InvestigationLog entries={mystery.log} />
              </details>
            </>
          ) : (
            <LegacyLog log={data.log} />
          )}
        </>
      )}
    </GameSceneFrame>
  );
}

function HistoryRewards({ record }: { record: DungeonHistoryDetail }) {
  const items = record.result.inventoryRewards ?? [];
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">此行所得</h2>
      {record.realGains?.length ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {record.realGains.map((gain, index) => (
            <div key={index} className="flex items-baseline gap-2">
              <dt className="text-ink-secondary">
                {gain.name || getResourceTypeLabel(gain.type)}
              </dt>
              <dd className="font-mono">{gain.value.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item, index) => (
            <ItemSlot
              key={index}
              className="w-20"
              quantityLabel="奖励"
              item={{
                definitionId: item.definitionId,
                instanceData: item.instanceData ?? null,
                name: dungeonRewardItemName(item),
                quantity: item.quantity,
              }}
            />
          ))}
        </div>
      ) : null}
      {!items.length && !record.realGains?.length ? (
        <p className="text-ink-secondary text-sm">此行未获物品或修为。</p>
      ) : null}
    </section>
  );
}

function InvestigationLog({ entries }: { entries: MysteryLogEntry[] }) {
  const turns = new Map<number, MysteryLogEntry[]>();
  for (const entry of entries) {
    const group = turns.get(entry.turn) ?? [];
    group.push(entry);
    turns.set(entry.turn, group);
  }
  return (
    <div className="mt-4 space-y-5">
      {[...turns].map(([turn, group]) => (
        <section key={turn} className="space-y-2">
          <h3 className="text-ink-secondary text-xs">
            {turn === 0 ? (
              '初入秘境'
            ) : (
              <>
                第 <span className="font-mono">{turn}</span> 次行动
              </>
            )}
          </h3>
          {group.map((entry, index) => (
            <MysteryLogLine key={index} entry={entry} archived />
          ))}
        </section>
      ))}
      {!entries.length ? <InkNotice>此行未留下调查经过。</InkNotice> : null}
    </div>
  );
}

/** 旧版札记保留已有内容，不把缺失的选项渲染成文字。 */
function LegacyLog({ log }: { log: string }) {
  const entries = [
    ...log.matchAll(/\[Round (\d+)\]\s*([\s\S]*?)(?=\[Round \d+\]|$)/g),
  ].map((match) => {
    const [scene, choice] = match[2]!.split(' -> Choice: ');
    return {
      round: match[1],
      scene: scene.trim(),
      choice:
        choice && !['undefined', 'null'].includes(choice.trim())
          ? choice.trim()
          : null,
    };
  });
  return (
    <section className="border-ink/15 space-y-4 border-t border-dashed pt-4">
      <h2 className="text-sm font-semibold">探险经过</h2>
      <p className="text-ink-secondary text-xs">
        这份札记未保存新版调查明细，仅展示当时留存的经过。
      </p>
      {entries.length ? (
        entries.map((entry, index) => (
          <div key={index} className="space-y-2 text-sm leading-7">
            <h3 className="text-ink-secondary text-xs">
              第 <span className="font-mono">{entry.round}</span> 回
            </h3>
            <p className="whitespace-pre-line">{entry.scene}</p>
            {entry.choice ? (
              <p className="text-ink-secondary">选择：{entry.choice}</p>
            ) : null}
          </div>
        ))
      ) : (
        <p className="text-sm leading-7 whitespace-pre-line">
          {log || '暂无详细记录。'}
        </p>
      )}
    </section>
  );
}
