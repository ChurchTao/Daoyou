import { JournalEventContent } from '@app/components/feature/journal/JournalEventContent';
import {
  GameLoadingState,
  GameSceneFrame,
  GameSceneTabs,
} from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  JournalCursor,
  PlayerJournalPage,
} from '@daoyou/contracts/player/journal';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

export default function JournalRoute() {
  const cultivatorId = usePlayerSession().data?.activeCultivator?.id;
  const [params, setParams] = useSearchParams();
  const selected = params.get('type');
  const type =
    selected === 'retreat.completed' ||
    selected === 'breakthrough.completed' ||
    selected === 'resources.settled'
      ? selected
      : '';
  return (
    <GameSceneFrame variant="lite">
      <GameSceneTabs
        activeValue={type}
        onChange={(value) => setParams(value ? { type: value } : {})}
        items={[
          { label: '全部', value: '' },
          { label: '闭关', value: 'retreat.completed' },
          { label: '突破', value: 'breakthrough.completed' },
          { label: '其他玩法', value: 'resources.settled' },
        ]}
      />
      {cultivatorId ? (
        <JournalList
          key={`${cultivatorId}:${type}`}
          cultivatorId={cultivatorId}
          type={type}
        />
      ) : null}
    </GameSceneFrame>
  );
}

function JournalList({
  cultivatorId,
  type,
}: {
  cultivatorId: string;
  type: string;
}) {
  const [items, setItems] = useState<PlayerJournalPage['items']>([]);
  const [cursor, setCursor] = useState<JournalCursor | null>(null);
  const [nextCursor, setNextCursor] = useState<JournalCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    const query = new URLSearchParams(type ? { type } : {});
    if (cursor) {
      query.set('before', cursor.createdAt);
      query.set('beforeId', cursor.id);
    }
    void fetchJsonCached<{ data: PlayerJournalPage }>(
      `/api/player-journal?${query}`,
      {
        key: `journal:${cultivatorId}:${query}`,
        signal: abort.signal,
        cache: 'no-store',
      },
    )
      .then(({ data }) => {
        if (abort.signal.aborted) return;
        setItems((previous) =>
          cursor ? [...previous, ...data.items] : data.items,
        );
        setNextCursor(data.nextCursor);
      })
      .catch((e: Error) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [cultivatorId, type, cursor, attempt]);
  return (
    <>
      <ol className="text-sm leading-6">
        {items.map((item) => (
          <li key={item.id} className="py-1">
            <time
              dateTime={item.createdAt}
              title={new Date(item.createdAt).toLocaleString('zh-CN', {
                hour12: false,
              })}
              className="text-ink-muted mr-2 font-mono text-xs whitespace-nowrap"
            >
              {new Date(item.createdAt).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </time>
            <JournalEventContent event={item.event} />
          </li>
        ))}
      </ol>
      {loading ? (
        <GameLoadingState message="正在翻阅修仙日志……" variant="inline" />
      ) : null}
      {error ? (
        <div role="alert">
          <InkNotice>{error}</InkNotice>
          <InkButton
            onClick={() => {
              setError('');
              setLoading(true);
              setAttempt((value) => value + 1);
            }}
          >
            重试
          </InkButton>
        </div>
      ) : null}
      {!loading && !error && !items.length ? (
        <InkNotice>
          尚无记录。道具、修为、感悟与各类货币的得失，会记在这里。
        </InkNotice>
      ) : null}
      {!loading && !error && nextCursor ? (
        <InkButton
          onClick={() => {
            setLoading(true);
            setCursor(nextCursor);
          }}
        >
          加载更多
        </InkButton>
      ) : null}
    </>
  );
}
