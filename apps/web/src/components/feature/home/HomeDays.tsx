import { HomeAct } from '@app/components/feature/home/HomeAct';
import { JournalEventContent } from '@app/components/feature/journal/JournalEventContent';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import { getDivination } from '@app/lib/divinationApi';
import type { DivinationView } from '@daoyou/contracts/divination';
import type { PlayerJournalPage } from '@daoyou/contracts/player/journal';
import { useEffect, useState } from 'react';

const SHOWN = 3;

/** 这几日：日志里最近的几笔，和案角那副今天的卦。 */
export function HomeDays({
  cultivatorId,
  journal,
  divination,
}: {
  cultivatorId: string;
  journal: boolean;
  divination: boolean;
}) {
  const [items, setItems] = useState<PlayerJournalPage['items'] | null>(null);
  const [unread, setUnread] = useState(false);
  const [omen, setOmen] = useState<DivinationView | null>(null);

  useEffect(() => {
    if (!journal) return;
    const abort = new AbortController();
    void fetchJsonCached<{ data: PlayerJournalPage }>('/api/player-journal', {
      key: `journal:${cultivatorId}:home`,
      signal: abort.signal,
      cache: 'no-store',
    })
      .then(({ data }) => {
        if (!abort.signal.aborted) setItems(data.items.slice(0, SHOWN));
      })
      .catch(() => {
        if (!abort.signal.aborted) setUnread(true);
      });
    return () => abort.abort();
  }, [cultivatorId, journal]);

  useEffect(() => {
    if (!divination) return;
    const abort = new AbortController();
    void getDivination(abort.signal)
      .then((view) => {
        if (!abort.signal.aborted) setOmen(view);
      })
      .catch(() => undefined);
    return () => abort.abort();
  }, [cultivatorId, divination]);

  const record = omen && !omen.canDraw ? omen.record : null;

  return (
    <>
      {journal ? (
        unread ? (
          <p className="text-ink-secondary text-base leading-8">
            日志这会儿翻不开，过一阵再看。
          </p>
        ) : items && items.length === 0 ? (
          <p className="text-ink-secondary text-base leading-8">
            还没有值得记一笔的事。
          </p>
        ) : items ? (
          <ol className="text-ink-secondary text-sm leading-7 [&_span]:whitespace-normal">
            {items.map((item) => (
              <li key={item.id} className="py-1">
                <JournalEventContent event={item.event} />
              </li>
            ))}
          </ol>
        ) : null
      ) : null}
      {journal && items && items.length > 0 ? (
        <HomeAct href="/game/journal" lead="往前翻日志" />
      ) : null}
      {divination && omen ? (
        record ? (
          <HomeAct
            href="/game/divination"
            lead={
              record.rewardGranted
                ? '再看一眼今天的卦'
                : record.interpretation
                  ? '收下签礼'
                  : '把卦解完'
            }
            note={record.omen.name}
          />
        ) : (
          <HomeAct href="/game/divination" lead="案角的龟甲">
            ，今天还没动过
          </HomeAct>
        )
      ) : null}
    </>
  );
}
