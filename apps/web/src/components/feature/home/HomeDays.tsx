import { HomeAct, HomeLabel } from '@app/components/feature/home/HomeAct';
import { JournalEventContent } from '@app/components/feature/journal/JournalEventContent';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import type { PlayerJournalPage } from '@daoyou/contracts/player/journal';
import { useEffect, useState } from 'react';

const SHOWN = 3;

export function HomeDays({ cultivatorId }: { cultivatorId: string }) {
  const [items, setItems] = useState<PlayerJournalPage['items'] | null>(null);
  const [unread, setUnread] = useState(false);

  useEffect(() => {
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
  }, [cultivatorId]);

  return (
    <section>
      <HomeLabel>最近记录</HomeLabel>
      {unread ? (
        <p className="text-ink-secondary text-sm leading-7">
          暂时无法读取日志。
        </p>
      ) : items?.length === 0 ? (
        <p className="text-ink-secondary text-sm leading-7">暂无记录。</p>
      ) : (
        items && (
          <ol className="text-ink-secondary text-sm leading-7 [&_span]:whitespace-normal">
            {items.map((item) => (
              <li key={item.id} className="py-1">
                <JournalEventContent event={item.event} />
              </li>
            ))}
          </ol>
        )
      )}
      <HomeAct href="/game/journal" lead="查看日志" />
    </section>
  );
}
