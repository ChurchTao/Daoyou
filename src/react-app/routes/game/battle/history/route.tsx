import { CombatV6HistoryList } from '@app/components/feature/combat-v6/CombatV6HistoryList';
import { combatV6HistorySources as sources } from '@app/components/feature/combat-v6/presentation';
import { combatV6Request } from '@app/components/feature/combat-v6/request';
import { GameLoadingState, GameSceneTabs } from '@app/components/game-shell';
import { InkButton, InkNotice } from '@app/components/ui';
import { usePlayerSession } from '@app/lib/resources/player';
import type { CombatV6HistoryPage } from '@shared/contracts/combatV6Replay';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

export default function BattleHistoryRoute() {
  const characterId = usePlayerSession().data?.activeCultivator?.id;
  const [params, setParams] = useSearchParams();
  const source = params.get('source') ?? '';
  const page = Math.min(
    10000,
    Math.max(1, Math.trunc(Number(params.get('page')) || 1)),
  );
  const selected = Object.prototype.hasOwnProperty.call(sources, source)
    ? source
    : '';
  return (
    <div className="space-y-4">
      <GameSceneTabs
        activeValue={selected}
        onChange={(value) => setParams(value ? { source: value } : {})}
        items={[
          { label: '全部', value: '' },
          ...Object.entries(sources).map(([value, label]) => ({
            value,
            label,
          })),
        ]}
      />
      <HistoryPage
        key={`${characterId}:${selected}:${page}`}
        source={selected}
        page={page}
        onPage={(next) =>
          setParams({
            ...(selected ? { source: selected } : {}),
            page: String(next),
          })
        }
      />
    </div>
  );
}
function HistoryPage({
  source,
  page,
  onPage,
}: {
  source: string;
  page: number;
  onPage: (page: number) => void;
}) {
  const [data, setData] = useState<CombatV6HistoryPage>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void combatV6Request<CombatV6HistoryPage>(
      `/api/combat-v6/replays?page=${page}${source ? `&source=${source}` : ''}`,
      { signal: abort.signal, cache: 'no-store' },
    )
      .then((result) => {
        if (!abort.signal.aborted) setData(result);
      })
      .catch((e: Error) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [source, page, attempt]);
  if (error)
    return (
      <div role="alert">
        <InkNotice>{error}</InkNotice>
        <InkButton
          onClick={() => {
            setError('');
            setAttempt((n) => n + 1);
          }}
        >
          重试
        </InkButton>
      </div>
    );
  if (!data)
    return <GameLoadingState message="正在翻阅战绩……" variant="inline" />;
  return (
    <>
      {!data.items.length ? (
        <InkNotice>暂无战斗记录。</InkNotice>
      ) : (
        <CombatV6HistoryList items={data.items} />
      )}
      <div className="flex items-center justify-between text-sm">
        <InkButton disabled={page === 1} onClick={() => onPage(page - 1)}>
          上一页
        </InkButton>
        <span>第 {page} 页</span>
        <InkButton disabled={!data.hasMore} onClick={() => onPage(page + 1)}>
          下一页
        </InkButton>
      </div>
    </>
  );
}
