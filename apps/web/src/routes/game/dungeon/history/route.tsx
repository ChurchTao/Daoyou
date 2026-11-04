import { GameLoadingState, GameSceneFrame } from '@app/components/game-shell';
import Link from '@app/components/router/AppLink';
import { InkButton, InkNotice } from '@app/components/ui';
import { usePlayerSession } from '@app/lib/resources/player';
import type { DungeonHistoryPage } from '@daoyou/contracts/dungeon/history';
import { useSearchParams } from 'react-router';
import { historyDate, historyPage, useHistory } from './useHistory';

export default function DungeonHistoryPage() {
  const owner = usePlayerSession().data?.activeCultivator?.id;
  const [params, setParams] = useSearchParams();
  const page = historyPage(params.get('page'));
  return (
    <GameSceneFrame variant="lite">
      {owner ? (
        <HistoryList
          key={`${owner}:${page}`}
          owner={owner}
          page={page}
          onPage={(next) => setParams(next === 1 ? {} : { page: String(next) })}
        />
      ) : null}
    </GameSceneFrame>
  );
}

function HistoryList({
  owner,
  page,
  onPage,
}: {
  owner: string;
  page: number;
  onPage: (page: number) => void;
}) {
  const { data, error, retry } = useHistory<DungeonHistoryPage>(
    `/api/dungeon/history?page=${page}&pageSize=10`,
    owner,
  );
  if (error)
    return (
      <div role="alert">
        <InkNotice tone="danger">{error}</InkNotice>
        <InkButton onClick={retry}>重新翻阅</InkButton>
      </div>
    );
  if (!data)
    return <GameLoadingState message="正在翻阅札记……" variant="inline" />;
  return (
    <>
      <p className="text-ink-secondary text-sm">
        共 <span className="font-mono">{data.pagination.total}</span> 次探险
      </p>
      {!data.records.length ? (
        <InkNotice>
          {page > 1
            ? '这一页没有札记，请翻回前页。'
            : '尚无探险记录，结束探索后可在此回顾。'}
        </InkNotice>
      ) : (
        <ol className="divide-ink/15 divide-y divide-dashed">
          {data.records.map((record) => (
            <li key={record.id}>
              <Link
                href={`/game/dungeon/history/${record.id}?page=${page}`}
                className="hover:bg-ink/4 flex items-start justify-between gap-4 py-4 transition-colors"
              >
                <div className="min-w-0 space-y-1">
                  <h2 className="font-semibold break-words">{record.title}</h2>
                  {record.title !== record.theme ? (
                    <p className="text-ink-secondary text-sm">{record.theme}</p>
                  ) : null}
                  <time
                    dateTime={record.createdAt}
                    className="text-ink-secondary block text-xs"
                  >
                    {historyDate(record.createdAt)}
                  </time>
                </div>
                <div className="shrink-0 space-y-1 text-right text-sm">
                  {record.score !== null ? (
                    <p>
                      推理{' '}
                      <span className="font-mono font-semibold">
                        {record.score}
                      </span>
                      <span className="text-ink-secondary">/100</span>
                    </p>
                  ) : null}
                  {record.rewardTier ? (
                    <p className="text-ink-secondary">
                      评价{' '}
                      <span className="font-mono">{record.rewardTier}</span>
                    </p>
                  ) : null}
                  <span className="text-crimson">翻阅札记 →</span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
      {data.pagination.totalPages > 1 || page > 1 ? (
        <nav
          aria-label="札记分页"
          className="flex items-center justify-between gap-3 pt-3 text-sm"
        >
          <InkButton disabled={page <= 1} onClick={() => onPage(page - 1)}>
            上一页
          </InkButton>
          <span className="text-ink-secondary font-mono">
            {page} / {Math.max(1, data.pagination.totalPages)}
          </span>
          <InkButton
            disabled={page >= data.pagination.totalPages}
            onClick={() => onPage(page + 1)}
          >
            下一页
          </InkButton>
        </nav>
      ) : null}
    </>
  );
}
